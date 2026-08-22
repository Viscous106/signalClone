import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginFlow } from "./LoginFlow";

// The US is the default country, so a national number of 5551234567 makes
// +15551234567 on the wire.
const NATIONAL = "5551234567";
const PHONE = "+15551234567";

function mockApi(handlers: Record<string, () => { status: number; body: unknown }>) {
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    const path = url.toString();
    const key = Object.keys(handlers).find((k) => path.includes(k));
    if (!key) throw new Error(`unmocked request: ${path} ${init?.method}`);
    const { status, body } = handlers[key]();
    return { ok: status < 400, status, json: async () => body } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const ok = (body: unknown) => () => ({ status: 200, body });
const bad = (detail: string) => () => ({ status: 400, body: { detail } });

type User = ReturnType<typeof userEvent.setup>;

async function enterPhone(user: User) {
  await user.type(screen.getByLabelText(/phone number/i), NATIONAL);
  await user.click(screen.getByRole("button", { name: /next/i }));
}

/** The code lives in six separate boxes, so type it key by key. */
async function enterCode(user: User, code = "123456") {
  const group = await screen.findByRole("group", { name: /verification code/i });
  await user.click(group.querySelectorAll("input")[0]);
  await user.keyboard(code);
  await user.click(screen.getByRole("button", { name: /next/i }));
}

describe("LoginFlow", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("starts on the phone step", () => {
    mockApi({});
    render(<LoginFlow onAuthenticated={vi.fn()} />);
    expect(screen.getByRole("heading", { name: /phone number/i })).toBeInTheDocument();
  });

  it('lets a returning user correct the number with "Wrong number?"', async () => {
    const user = userEvent.setup();
    mockApi({ "/auth/start": ok({ otp_sent: true, is_new: false }) });
    render(<LoginFlow onAuthenticated={vi.fn()} />);

    await enterPhone(user);
    await user.click(await screen.findByRole("button", { name: /wrong number/i }));

    expect(screen.getByRole("heading", { name: /phone number/i })).toBeInTheDocument();
  });

  it("will not submit an implausible number", async () => {
    const user = userEvent.setup();
    mockApi({});
    render(<LoginFlow onAuthenticated={vi.fn()} />);

    await user.type(screen.getByLabelText(/phone number/i), "555");
    expect(screen.getByRole("button", { name: /next/i })).toBeDisabled();
  });

  it("offers a country selector, defaulting to the United States", () => {
    mockApi({});
    render(<LoginFlow onAuthenticated={vi.fn()} />);
    expect(screen.getByText("United States")).toBeInTheDocument();
    expect(screen.getByText("+1")).toBeInTheDocument();
  });

  it("uses the chosen country's dial code on the wire", async () => {
    const user = userEvent.setup();
    const fetchMock = mockApi({ "/auth/start": ok({ otp_sent: true, is_new: false }) });
    render(<LoginFlow onAuthenticated={vi.fn()} />);

    await user.click(screen.getByText("United States"));
    await user.click(await screen.findByText("India"));
    await user.type(screen.getByLabelText(/phone number/i), "9834758028");
    await user.click(screen.getByRole("button", { name: /next/i }));

    const call = fetchMock.mock.calls.find((c) => String(c[0]).includes("/auth/start"));
    expect(JSON.parse(String(call?.[1]?.body))).toEqual({ phone: "+919834758028" });
  });

  it("moves to the code step and echoes the number back", async () => {
    const user = userEvent.setup();
    mockApi({ "/auth/start": ok({ otp_sent: true, is_new: false }) });
    render(<LoginFlow onAuthenticated={vi.fn()} />);

    await enterPhone(user);

    expect(await screen.findByRole("group", { name: /verification code/i })).toBeInTheDocument();
    expect(screen.getByText(/555 123 4567/)).toBeInTheDocument();
  });

  it("never asks a returning user for a name, even typing a full number", async () => {
    // The bug: with the default country selected, typing +91… produced
    // +1 91…, a different number, so an existing account looked new and was
    // asked to pick a name again.
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    const fetchMock = mockApi({
      "/auth/start": ok({ otp_sent: true, is_new: false }),
      "/auth/verify": ok({ id: 9, display_name: "Yash Virulkar" }),
    });
    render(<LoginFlow onAuthenticated={onAuthenticated} />);

    await user.type(screen.getByLabelText(/phone number/i), "+919834758028");
    await user.click(screen.getByRole("button", { name: /next/i }));

    const start = fetchMock.mock.calls.find((c) => String(c[0]).includes("/auth/start"));
    expect(JSON.parse(String(start?.[1]?.body))).toEqual({ phone: "+919834758028" });

    await enterCode(user);

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalled());
    expect(screen.queryByLabelText(/your name/i)).not.toBeInTheDocument();
  });

  it("switches the country selector to match a typed international number", async () => {
    const user = userEvent.setup();
    mockApi({});
    render(<LoginFlow onAuthenticated={vi.fn()} />);

    expect(screen.getByText("United States")).toBeInTheDocument();
    await user.type(screen.getByLabelText(/phone number/i), "+919834758028");

    expect(screen.getByText("India")).toBeInTheDocument();
    expect(screen.getByText("+91")).toBeInTheDocument();
  });

  it("logs a returning user straight in", async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    mockApi({
      "/auth/start": ok({ otp_sent: true, is_new: false }),
      "/auth/verify": ok({ id: 1, display_name: "Bob" }),
    });
    render(<LoginFlow onAuthenticated={onAuthenticated} />);

    await enterPhone(user);
    await enterCode(user);

    await waitFor(() =>
      expect(onAuthenticated).toHaveBeenCalledWith(
        expect.objectContaining({ display_name: "Bob" })
      )
    );
    expect(screen.queryByLabelText(/your name/i)).not.toBeInTheDocument();
  });

  it("shows the server's error on a wrong code and stays put", async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    mockApi({
      "/auth/start": ok({ otp_sent: true, is_new: false }),
      "/auth/verify": bad("Incorrect verification code"),
    });
    render(<LoginFlow onAuthenticated={onAuthenticated} />);

    await enterPhone(user);
    await enterCode(user, "000000");

    expect(await screen.findByText(/incorrect verification code/i)).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /verification code/i })).toBeInTheDocument();
    expect(onAuthenticated).not.toHaveBeenCalled();
  });

  it("asks a new user for a display name before registering", async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    const fetchMock = mockApi({
      "/auth/start": ok({ otp_sent: true, is_new: true }),
      "/auth/verify": ok({ id: 2, display_name: "Alice Chen" }),
    });
    render(<LoginFlow onAuthenticated={onAuthenticated} />);

    await enterPhone(user);
    await enterCode(user);

    await user.type(await screen.findByLabelText(/your name/i), "Alice Chen");
    await user.click(screen.getByRole("button", { name: /next/i }));

    await waitFor(() => expect(onAuthenticated).toHaveBeenCalled());

    const verifyCall = fetchMock.mock.calls.find((c) => String(c[0]).includes("/auth/verify"));
    expect(JSON.parse(String(verifyCall?.[1]?.body))).toMatchObject({
      phone: PHONE,
      code: "123456",
      display_name: "Alice Chen",
    });
  });

  it("sends a new user back to the code step if the code was wrong", async () => {
    const user = userEvent.setup();
    mockApi({
      "/auth/start": ok({ otp_sent: true, is_new: true }),
      "/auth/verify": bad("Incorrect verification code"),
    });
    render(<LoginFlow onAuthenticated={vi.fn()} />);

    await enterPhone(user);
    await enterCode(user, "999999");
    await user.type(await screen.findByLabelText(/your name/i), "Alice");
    await user.click(screen.getByRole("button", { name: /next/i }));

    expect(await screen.findByRole("group", { name: /verification code/i })).toBeInTheDocument();
    expect(screen.getByText(/incorrect verification code/i)).toBeInTheDocument();
  });
});
