import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginFlow } from "./LoginFlow";

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
  await user.type(screen.getByLabelText(/phone number/i), PHONE);
  await user.click(screen.getByRole("button", { name: /continue/i }));
}

async function enterCode(user: User, code = "123456") {
  await user.type(await screen.findByLabelText(/verification code/i), code);
  await user.click(screen.getByRole("button", { name: /continue|verify/i }));
}

describe("LoginFlow", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("starts on the phone step", () => {
    mockApi({});
    render(<LoginFlow onAuthenticated={vi.fn()} />);
    expect(screen.getByLabelText(/phone number/i)).toBeInTheDocument();
  });

  it("will not submit an implausible number", async () => {
    const user = userEvent.setup();
    mockApi({});
    render(<LoginFlow onAuthenticated={vi.fn()} />);

    await user.type(screen.getByLabelText(/phone number/i), "555");
    expect(screen.getByRole("button", { name: /continue/i })).toBeDisabled();
  });

  it("moves to the code step and echoes the number back", async () => {
    const user = userEvent.setup();
    mockApi({ "/auth/start": ok({ otp_sent: true, is_new: false }) });
    render(<LoginFlow onAuthenticated={vi.fn()} />);

    await enterPhone(user);

    expect(await screen.findByLabelText(/verification code/i)).toBeInTheDocument();
    expect(screen.getByText(/555 123 4567/)).toBeInTheDocument();
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
    expect(screen.getByLabelText(/verification code/i)).toBeInTheDocument();
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
    await user.click(screen.getByRole("button", { name: /finish|continue/i }));

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
    await user.click(screen.getByRole("button", { name: /finish|continue/i }));

    expect(await screen.findByLabelText(/verification code/i)).toBeInTheDocument();
    expect(screen.getByText(/incorrect verification code/i)).toBeInTheDocument();
  });
});
