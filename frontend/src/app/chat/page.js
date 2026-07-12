"use client";

import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";

export default function ChatPage() {
  // =========================
  // STATE
  // =========================

  const [user, setUser] = useState(null);

  // Session chat yang sedang aktif
  const [sessionId, setSessionId] = useState(null);

  const [pesan, setPesan] = useState("");

  const [loading, setLoading] = useState(false);

  const [chat, setChat] = useState([
    {
      sender: "bot",
      text: "Halo 👋 Aku siap membantu permasalahan akademikmu hari ini.",
    },
  ]);

  // Sidebar
  const [chatList, setChatList] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Token Usage
  const [tokenUsage, setTokenUsage] = useState({
    prompt: 0,
    completion: 0,
    total: 0,
  });

  const chatEndRef = useRef(null);

  // =========================
  // CEK LOGIN
  // =========================
  useEffect(() => {
    const initChat = async () => {
      const data = JSON.parse(localStorage.getItem("user"));

      if (!data) {
        window.location.href = "/login";
        return;
      }

      setUser(data);

      const sessions = await loadChatSessions(data.id);

      if (sessions.length > 0) {
        const latest = sessions[0];

        setSessionId(latest.id);

        loadChat(latest.id);
      } else {
        const id = await createNewChat(data.id);

        if (id) {
          setSessionId(id);
          loadChat(id);
          loadChatSessions(data.id);
        }
      }
    };

    initChat();
  }, []);
  // =========================
  // AUTO SCROLL
  // =========================
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [chat]);

  // =========================
  // LOAD CHAT HISTORY
  // =========================
  const loadChat = async (sessionId) => {
    try {
      const response = await fetch(
        `https://curhat-akademik-backend.vercel.app/get-chat/${sessionId}`,
      );

      const data = await response.json();

      if (data.usage) {
        setTokenUsage({
          prompt: data.usage.prompt_tokens,
          completion: data.usage.completion_tokens,
          total: data.usage.total_tokens,
        });
      }

      let history = [
        {
          sender: "bot",
          text: "Halo 👋 Aku siap mendengarkan curhatanmu hari ini.",
        },
      ];

      data.forEach((item) => {
        history.push({
          sender: "user",
          text: item.pesan_user,
        });

        if (item.respon_gpt) {
          history.push({
            sender: "bot",
            text: item.respon_gpt,
          });
        }
      });

      setChat(history);
    } catch (error) {
      console.error(error);
    }
  };

  // =========================
  // CREATE NEW CHAT
  // =========================
  const createNewChat = async (userId, title = "Chat Baru") => {
    console.log("User ID:", userId);
    try {
      const response = await fetch(
        "https://curhat-akademik-backend.vercel.app/new-chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: userId,
            title,
          }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message);
      }

      return data.session.id;
    } catch (error) {
      console.error(error);
      return null;
    }
  };

  // =========================
  // LOAD CHAT SESSIONS
  // =========================
  const loadChatSessions = async (userId) => {
    try {
      const response = await fetch(
        `https://curhat-akademik-backend.vercel.app/chat-sessions/${userId}`,
      );

      const data = await response.json();

      setChatList(data);

      return data;
    } catch (error) {
      console.error(error);
      return [];
    }
  };

  // =========================
  // KIRIM PESAN
  // =========================
  const kirimPesan = async () => {
    if (!pesan.trim()) return;

    const pesanUser = pesan;

    setPesan("");

    // Tampilkan pesan user langsung
    setChat((prev) => [
      ...prev,
      {
        sender: "user",
        text: pesanUser,
      },
    ]);

    setLoading(true);

    try {
      // =========================
      // MINTA JAWABAN GPT
      // =========================
      const response = await fetch(
        "https://curhat-akademik-backend.vercel.app/chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            user_id: user.id,
            session_id: sessionId,
            pesan: pesanUser,
          }),
        },
      );

      const data = await response.json();

      console.log("Response GPT:", data);

      if (!response.ok) {
        throw new Error(data.error || "Gagal mendapatkan jawaban AI");
      }

      // Backend mengembalikan:
      // { respon_gpt: "..." }
      const jawabanGPT = data.respon_gpt;

      console.log("Jawaban GPT:", jawabanGPT);

      // Tampilkan jawaban AI
      setChat((prev) => [
        ...prev,
        {
          sender: "bot",
          text: jawabanGPT,
        },
      ]);

      // =========================
      // SIMPAN KE DATABASE
      // =========================
      const payload = {
        user_id: user.id,
        session_id: sessionId,
        pesan_user: pesanUser,
        respon_gpt: jawabanGPT,
      };
      console.log("Payload:", payload);

      const saveResponse = await fetch(
        "https://curhat-akademik-backend.vercel.app/save-chat",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      const saveData = await saveResponse.json();

      console.log("Save Chat:", saveData);
      await loadChatSessions(user.id);
    } catch (error) {
      console.error(error);

      setChat((prev) => [
        ...prev,
        {
          sender: "bot",
          text: "Maaf, terjadi kesalahan saat menghubungi AI.",
        },
      ]);
    }

    setLoading(false);
  };

  return (
    <main className="h-screen bg-slate-950 text-white flex">
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`
            fixed
            top-0
            left-0
            h-full
            w-72 max-w-[85vw]
            bg-slate-900
            border-r
            border-slate-800
            flex
            flex-col
            z-50
            transition-transform duration-300 ease-in-out
            ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
            md:static
            md:translate-x-0
      `}
      >
        <div className="p-5 border-b border-slate-800">
          <div className="flex justify-between items-center">
            <h1 className="text-lg md:text-2xl font-bold">
              🧠 Curhat Akademik
            </h1>

            <button
              className="md:hidden text-2xl"
              onClick={() => setSidebarOpen(false)}
            >
              ✕
            </button>
          </div>

          <p className="text-sm text-slate-400 mt-1">AI Pendamping Mahasiswa</p>

          <button
            className="w-full mt-4 bg-blue-600 hover:bg-blue-700 rounded-xl py-3 font-semibold transition"
            onClick={async () => {
              const id = await createNewChat(user.id);

              if (!id) return;

              setSessionId(id);
              setSidebarOpen(false);

              setChat([
                {
                  sender: "bot",
                  text: "Halo 👋 Aku siap membantu permasalahan akademikmu hari ini.",
                },
              ]);

              setPesan("");

              setLoading(false);

              setTokenUsage({
                prompt: 0,
                completion: 0,
                total: 0,
              });

              await loadChatSessions(user.id);

              loadChat(id);
            }}
          >
            + New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {chatList.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                setSidebarOpen(false);
                setSessionId(item.id);
                loadChat(item.id);
              }}
              className={`rounded-xl px-4 py-3 cursor-pointer transition
      ${
        sessionId === item.id
          ? "bg-blue-600"
          : "bg-slate-800 hover:bg-slate-700"
      }`}
            >
              💬 {item.title}
            </div>
          ))}
        </div>
      </aside>

      <div className="flex-1 flex flex-col w-full">
        {/* HEADER */}

        <header className="border-b border-slate-800 bg-slate-900">
          <div className="px-4 md:px-8 py-4 flex justify-between items-center">
            <div className="flex items-center gap-3">
              <button
                className="md:hidden text-2xl"
                onClick={() => setSidebarOpen(true)}
              >
                ☰
              </button>

              <div>
                <h1 className="text-lg md:text-2xl font-bold">
                  Curhat Akademik AI
                </h1>

                <p className="text-slate-400 text-sm">
                  Selamat datang, {user?.nama}
                </p>
              </div>
            </div>

            <button
              onClick={() => {
                localStorage.removeItem("user");
                window.location.href = "/login";
              }}
              className="bg-red-500 hover:bg-red-600 px-3 md:px-5 py-2 rounded-xl text-sm md:text-base transition"
            >
              Logout
            </button>
          </div>
        </header>

        {/* CHAT */}

        <section className="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-8">
          <div className="max-w-5xl mx-auto space-y-6">
            {chat.map((item, index) => (
              <div
                key={index}
                className={`flex ${
                  item.sender === "user" ? "justify-end" : "justify-start"
                }`}
              >
                <div className="flex gap-2 md:gap-3 items-end">
                  {item.sender === "bot" && (
                    <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-slate-700 flex items-center justify-center">
                      🤖
                    </div>
                  )}

                  <div
                    className={`
                    max-w-[85%] md:max-w-xl
                    px-4 md:px-6
                    py-3 md:py-4
                    rounded-3xl
                    shadow-lg
                    whitespace-pre-wrap
                    ${
                      item.sender === "user"
                        ? "bg-blue-600"
                        : "bg-slate-800 prose prose-sm md:prose prose-invert"
                    }
                  `}
                  >
                    {item.sender === "bot" ? (
                      <ReactMarkdown>{item.text}</ReactMarkdown>
                    ) : (
                      item.text
                    )}
                  </div>

                  {item.sender === "user" && (
                    <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-slate-700 flex items-center justify-center">
                      👤
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex">
                <div className="flex gap-2 md:gap-3">
                  <div className="w-9 h-9 md:w-11 md:h-11 rounded-full bg-gradient-to-r from-blue-500 to-purple-600 flex items-center justify-center">
                    🤖
                  </div>

                  <div className="bg-slate-800 rounded-3xl px-4 md:px-6 py-3 md:py-4">
                    AI sedang mengetik...
                  </div>
                </div>
              </div>
            )}

            <div ref={chatEndRef}></div>
          </div>
        </section>

        {/* INPUT CHAT */}

        <footer className="border-t border-slate-800 bg-slate-900">
          <div className="max-w-5xl mx-auto p-3 md:p-5">
            <div className="flex gap-3">
              <input
                type="text"
                value={pesan}
                placeholder="Tulis Curhatan Anda"
                onChange={(e) => setPesan(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    kirimPesan();
                  }
                }}
                className="
              flex-1
              bg-slate-800
              border
              border-slate-700
              rounded-full
              px-4 md:px-6
              py-3 md:py-4
              outline-none
              focus:border-blue-500
              transition
            "
              />

              <button
                onClick={kirimPesan}
                disabled={loading}
                className="
              bg-gradient-to-r
              from-blue-600
              to-purple-600
              hover:from-blue-700
              hover:to-purple-700
              disabled:bg-slate-700
              w-12 h-12 md:w-auto md:h-auto md:px-7
              rounded-full
              font-bold
              transition
            "
              >
                {loading ? "..." : "➤"}
              </button>
            </div>
          </div>
        </footer>
      </div>
    </main>
  );
}
