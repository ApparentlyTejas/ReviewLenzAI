import json
from unittest.mock import patch

from app.services.llm_service import LLMReviewError
from tests.conftest import register_and_login as _register_and_login

_PATCH_TARGET = "app.routers.dashboard_chat"


def _sse_events(response_text: str) -> list[dict]:
    events = []
    for frame in response_text.split("\n\n"):
        frame = frame.strip()
        if not frame:
            continue
        assert frame.startswith("data: ")
        events.append(json.loads(frame[len("data: ") :]))
    return events


def _fake_stream(*chunks: str):
    def _generator(**kwargs):
        yield from chunks

    return _generator


@patch(f"{_PATCH_TARGET}.stream_dashboard_answer")
def test_send_dashboard_chat_message_streams_and_persists(mock_stream, client):
    headers = _register_and_login(client, "dchat1@example.com")
    mock_stream.side_effect = _fake_stream("You have ", "no repos connected yet.")

    response = client.post("/dashboard/chat", json={"content": "What's my status?"}, headers=headers)

    assert response.status_code == 200
    events = _sse_events(response.text)
    deltas = [e["content"] for e in events if e["type"] == "delta"]
    assert deltas == ["You have ", "no repos connected yet."]
    done = [e for e in events if e["type"] == "done"][0]
    assert done["message"]["content"] == "You have no repos connected yet."

    history = client.get("/dashboard/chat", headers=headers).json()
    assert len(history) == 2
    assert history[0]["role"] == "user"
    assert history[0]["content"] == "What's my status?"
    assert history[1]["role"] == "assistant"


@patch(f"{_PATCH_TARGET}.is_on_topic", return_value=False)
@patch(f"{_PATCH_TARGET}.stream_dashboard_answer")
def test_send_dashboard_chat_message_off_topic_question_is_blocked(mock_stream, mock_on_topic, client):
    headers = _register_and_login(client, "dchat-offtopic@example.com")

    response = client.post("/dashboard/chat", json={"content": "Write me a poem"}, headers=headers)

    assert response.status_code == 200
    events = _sse_events(response.text)
    assert len(events) == 1
    assert events[0]["type"] == "error"
    mock_stream.assert_not_called()

    history = client.get("/dashboard/chat", headers=headers).json()
    assert history == []


@patch(f"{_PATCH_TARGET}.build_dashboard_context")
@patch(f"{_PATCH_TARGET}.stream_dashboard_answer")
def test_send_dashboard_chat_message_passes_context_and_history(mock_stream, mock_context, client):
    from app.services.dashboard_context import DashboardContext

    headers = _register_and_login(client, "dchat2@example.com")
    mock_context.return_value = DashboardContext(summary_text="SOME CONTEXT", has_any_data=True)

    mock_stream.side_effect = _fake_stream("First answer")
    client.post("/dashboard/chat", json={"content": "First question"}, headers=headers)

    mock_stream.side_effect = _fake_stream("Second answer")
    client.post("/dashboard/chat", json={"content": "Second question"}, headers=headers)

    second_call_kwargs = mock_stream.call_args.kwargs
    assert second_call_kwargs["context"] == "SOME CONTEXT"
    assert second_call_kwargs["question"] == "Second question"
    assert second_call_kwargs["history"] == [
        {"role": "user", "content": "First question"},
        {"role": "assistant", "content": "First answer"},
    ]


@patch(f"{_PATCH_TARGET}.stream_dashboard_answer")
def test_send_dashboard_chat_message_llm_failure_does_not_persist_user_message(mock_stream, client):
    headers = _register_and_login(client, "dchat3@example.com")

    def _failing_generator(**kwargs):
        if False:
            yield ""
        raise LLMReviewError("Groq API call failed: boom")

    mock_stream.side_effect = _failing_generator

    response = client.post("/dashboard/chat", json={"content": "Will this fail?"}, headers=headers)

    assert response.status_code == 200
    events = _sse_events(response.text)
    assert events[-1]["type"] == "error"
    assert "boom" in events[-1]["detail"]

    history = client.get("/dashboard/chat", headers=headers).json()
    assert history == []


def test_dashboard_chat_requires_auth(client):
    assert client.post("/dashboard/chat", json={"content": "hi"}).status_code == 401
    assert client.get("/dashboard/chat").status_code == 401


@patch(f"{_PATCH_TARGET}.stream_dashboard_answer")
def test_dashboard_chat_is_scoped_per_user(mock_stream, client):
    headers_a = _register_and_login(client, "dchat-a@example.com")
    headers_b = _register_and_login(client, "dchat-b@example.com")

    mock_stream.side_effect = _fake_stream("Answer for A")
    client.post("/dashboard/chat", json={"content": "Question from A"}, headers=headers_a)

    history_b = client.get("/dashboard/chat", headers=headers_b).json()
    assert history_b == []

    history_a = client.get("/dashboard/chat", headers=headers_a).json()
    assert len(history_a) == 2


@patch(f"{_PATCH_TARGET}.stream_dashboard_answer")
def test_clear_dashboard_chat_messages_removes_all_history(mock_stream, client):
    headers = _register_and_login(client, "dchat-clear@example.com")
    mock_stream.side_effect = _fake_stream("An answer")
    client.post("/dashboard/chat", json={"content": "A question"}, headers=headers)
    assert len(client.get("/dashboard/chat", headers=headers).json()) == 2

    clear_resp = client.delete("/dashboard/chat", headers=headers)
    assert clear_resp.status_code == 204

    assert client.get("/dashboard/chat", headers=headers).json() == []


def test_clear_dashboard_chat_messages_requires_auth(client):
    assert client.delete("/dashboard/chat").status_code == 401


@patch(f"{_PATCH_TARGET}.stream_dashboard_answer")
def test_clear_dashboard_chat_messages_is_scoped_per_user(mock_stream, client):
    headers_a = _register_and_login(client, "dchat-clear-a@example.com")
    headers_b = _register_and_login(client, "dchat-clear-b@example.com")

    mock_stream.side_effect = _fake_stream("Answer for A")
    client.post("/dashboard/chat", json={"content": "Question from A"}, headers=headers_a)

    client.delete("/dashboard/chat", headers=headers_b)

    history_a = client.get("/dashboard/chat", headers=headers_a).json()
    assert len(history_a) == 2
