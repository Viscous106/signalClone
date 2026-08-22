class TestUserSearch:
    def test_finds_people_by_name_and_phone(self, client, login, make_user):
        make_user("+15550000002", "Bob Martinez")
        login("+15550000001", "Alice")

        assert client.get("/api/users/search?q=bob").json()[0]["display_name"] == "Bob Martinez"
        assert client.get("/api/users/search?q=0000002").json()[0]["display_name"] == "Bob Martinez"

    def test_is_case_insensitive_and_matches_partially(self, client, login, make_user):
        make_user("+15550000002", "Bob Martinez")
        login("+15550000001", "Alice")
        assert len(client.get("/api/users/search?q=MARTI").json()) == 1

    def test_never_returns_yourself(self, client, login):
        login("+15550000001", "Alice Chen")
        assert client.get("/api/users/search?q=Alice").json() == []

    def test_blank_query_returns_nothing_rather_than_everyone(self, client, login, make_user):
        make_user("+15550000002", "Bob")
        login("+15550000001", "Alice")
        assert client.get("/api/users/search?q=").json() == []

    def test_requires_a_session(self, client):
        assert client.get("/api/users/search?q=bob").status_code == 401


class TestContacts:
    def test_starts_empty_and_adds_by_phone(self, client, login, make_user):
        make_user("+15550000002", "Bob Martinez")
        login("+15550000001", "Alice")

        assert client.get("/api/contacts").json() == []
        added = client.post("/api/contacts", json={"phone": "+15550000002"})
        assert added.status_code == 201
        assert added.json()["display_name"] == "Bob Martinez"

        contacts = client.get("/api/contacts").json()
        assert [c["display_name"] for c in contacts] == ["Bob Martinez"]

    def test_accepts_a_differently_punctuated_number(self, client, login, make_user):
        make_user("+15550000002", "Bob")
        login("+15550000001", "Alice")
        assert client.post("/api/contacts", json={"phone": "+1 (555) 000-0002"}).status_code == 201

    def test_unknown_number_is_404(self, client, login):
        login("+15550000001", "Alice")
        r = client.post("/api/contacts", json={"phone": "+15559999999"})
        assert r.status_code == 404
        assert "signal" in r.json()["detail"].lower()

    def test_cannot_add_yourself(self, client, login):
        login("+15550000001", "Alice")
        r = client.post("/api/contacts", json={"phone": "+15550000001"})
        assert r.status_code == 400

    def test_adding_twice_is_idempotent(self, client, login, make_user):
        make_user("+15550000002", "Bob")
        login("+15550000001", "Alice")
        client.post("/api/contacts", json={"phone": "+15550000002"})
        second = client.post("/api/contacts", json={"phone": "+15550000002"})
        assert second.status_code in (200, 201)
        assert len(client.get("/api/contacts").json()) == 1

    def test_contacts_are_sorted_by_name(self, client, login, make_user):
        for phone, name in [("+15550000012", "Zoe"), ("+15550000013", "Adam"), ("+15550000014", "Mia")]:
            make_user(phone, name)
        login("+15550000001", "Alice")
        for phone in ["+15550000012", "+15550000013", "+15550000014"]:
            client.post("/api/contacts", json={"phone": phone})

        names = [c["display_name"] for c in client.get("/api/contacts").json()]
        assert names == ["Adam", "Mia", "Zoe"]

    def test_removing_a_contact(self, client, login, make_user):
        bob = make_user("+15550000002", "Bob")
        login("+15550000001", "Alice")
        client.post("/api/contacts", json={"phone": bob.phone})
        assert client.delete(f"/api/contacts/{bob.id}").status_code == 204
        assert client.get("/api/contacts").json() == []

    def test_my_address_book_is_mine_alone(self, client, login, make_user):
        """Contacts are directional — Bob adding Alice must not fill Alice's list."""
        make_user("+15550000002", "Bob")
        login("+15550000001", "Alice")
        client.post("/api/contacts", json={"phone": "+15550000002"})
        assert len(client.get("/api/contacts").json()) == 1

        client.post("/api/auth/logout")
        login("+15550000002")
        assert client.get("/api/contacts").json() == []


class TestPresence:
    def test_recently_seen_user_is_online(self, client, login, make_user):
        from datetime import datetime, timedelta, timezone

        make_user(
            "+15550000002", "Bob", last_seen_at=datetime.now(timezone.utc) - timedelta(seconds=30)
        )
        login("+15550000001", "Alice")
        assert client.get("/api/users/search?q=bob").json()[0]["online"] is True

    def test_long_absent_user_is_offline(self, client, login, make_user):
        from datetime import datetime, timedelta, timezone

        make_user(
            "+15550000002", "Bob", last_seen_at=datetime.now(timezone.utc) - timedelta(hours=3)
        )
        login("+15550000001", "Alice")
        assert client.get("/api/users/search?q=bob").json()[0]["online"] is False

    def test_never_seen_user_is_offline(self, client, login, make_user):
        make_user("+15550000002", "Bob")
        login("+15550000001", "Alice")
        assert client.get("/api/users/search?q=bob").json()[0]["online"] is False
