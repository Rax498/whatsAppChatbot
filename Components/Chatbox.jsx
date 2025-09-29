"use client";
import { Send, ArrowLeft, Bot } from "lucide-react";
import React, { useState, useRef, useEffect } from "react";

export default function Chatbox() {
  const [messages, setMessages] = useState([
    {
      id: 0,
      sender: "system",
      text: "systm",
      timestamp: Date.now(),
    },
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [chatBotUi, setchatBotUi] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSendMessage = async () => {
    const userInput = inputText.trim();
    if (!userInput) return;

    const userMessage = {
      id: Date.now(),
      sender: "user",
      text: userInput,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputText("");
    setIsTyping(true);

    try {
      const response = await fetch("api/Practice", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          req: userInput,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        console.error("API Error:", data);
        throw new Error(data.error?.message || "Unknown API error");
      }

      let rawReply = typeof data === "object" ? JSON.stringify(data) : data;

      console.log("reply form back :", rawReply);

      const botMessage = {
        id: Date.now() + 1,
        sender: "bot",
        text: rawReply,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, botMessage]);
    } catch (error) {
      console.error("Error talking to AI:", error);
      alert("Failed to fetch AI response: " + error.message);
    } finally {
      setIsTyping(false);
    }
  };
  const handleKeyPress = (e) => {
    if (e.key === "Enter") handleSendMessage();
  };

  return (
    <>
      <div className="chat-bot" onClick={() => setchatBotUi((prev) => !prev)}>
        <Bot size={30} />
      </div>
      {chatBotUi && (
        <div className="chat-container">
          <div className="chat-header">
            <div className="chat-name">
              <button
                className="back-button"
                onClick={() => window.history.back()}
              >
                <ArrowLeft />
              </button>
              <h1>Rista AI Bot</h1>
              <span className="status">{isTyping ? "Typing" : "Online"}</span>
            </div>
          </div>

          <div className="chat-messages">
            {messages
              .filter((msg) => msg.sender !== "system")
              .map((message) => (
                <div key={message.id} className={`message ${message.sender}`}>
                  <div className="message-bubble">
                    {message.text.split("\n").map((line, index) => (
                      <React.Fragment key={index}>
                        {line}
                        <br />
                      </React.Fragment>
                    ))}
                  </div>

                  <div className="message-time">
                    {message.sender === "bot" ? "Rista" : "You"}{" "}
                    {formatTime(message.timestamp)}
                  </div>
                </div>
              ))}

            {isTyping && (
              <div className="typing-indicator">
                <div className="message-bubble">
                  <div className="typing-dots">
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                    <div className="typing-dot"></div>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chat-input-container">
            <div className="chat-input-wrapper">
              <input
                ref={inputRef}
                type="text"
                className="chat-input"
                placeholder="Type your message..."
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyPress={handleKeyPress}
              />
              <button className="send-button" onClick={handleSendMessage}>
                <Send />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
