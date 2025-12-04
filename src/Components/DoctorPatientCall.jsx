// src/DoctorPatientCall.jsx
import React, { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, Video, User } from "lucide-react";
import io from "socket.io-client";

const SIGNALING_SERVER_URL = "http://localhost:5000";

export default function DoctorPatientCall() {
    const [socketId, setSocketId] = useState("");
    const [remoteId, setRemoteId] = useState("");
    const [connected, setConnected] = useState(false);

    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const pcRef = useRef(null);
    const localStreamRef = useRef(null);
    const socketRef = useRef(null);

    const RTC_CONFIG = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

    useEffect(() => {
        const socket = io(SIGNALING_SERVER_URL);
        socketRef.current = socket;

        socket.on("connect", () => setSocketId(socket.id));

        // incoming call
        socket.on("call-made", async ({ from, offer }) => {
            await enableLocalStream();
            createPeerConnection(from);

            await pcRef.current.setRemoteDescription(offer);
            const answer = await pcRef.current.createAnswer();
            await pcRef.current.setLocalDescription(answer);

            socket.emit("make-answer", { to: from, answer });
            setConnected(true);
        });

        // incoming answer
        socket.on("answer-made", async ({ answer }) => {
            if (pcRef.current)
                await pcRef.current.setRemoteDescription(answer);
            setConnected(true);
        });

        // ICE candidate
        socket.on("ice-candidate", async ({ candidate }) => {
            try {
                if (candidate && pcRef.current)
                    await pcRef.current.addIceCandidate(candidate);
            } catch (err) {
                console.error("ICE add error:", err);
            }
        });

        return () => socket.disconnect();
    }, []);

    async function enableLocalStream() {
        if (localStreamRef.current) return;

        const stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
        });

        localStreamRef.current = stream;
        localVideoRef.current.srcObject = stream;
    }

    function createPeerConnection(remoteSocket) {
        if (pcRef.current) return;

        const pc = new RTCPeerConnection(RTC_CONFIG);
        pcRef.current = pc;

        // local tracks add
        localStreamRef.current.getTracks().forEach((track) => {
            pc.addTrack(track, localStreamRef.current);
        });

        pc.ontrack = (event) => {
            remoteVideoRef.current.srcObject = event.streams[0];
        };

        pc.onicecandidate = (e) => {
            if (e.candidate) {
                socketRef.current.emit("ice-candidate", {
                    to: remoteSocket,
                    candidate: e.candidate,
                });
            }
        };
    }

    async function callUser() {
        if (!remoteId.trim()) return alert("Enter Remote User ID");

        await enableLocalStream();
        createPeerConnection(remoteId);

        const offer = await pcRef.current.createOffer();
        await pcRef.current.setLocalDescription(offer);

        socketRef.current.emit("call-user", { to: remoteId, offer });
    }

    function hangUp() {
        if (pcRef.current) {
            pcRef.current.close();
            pcRef.current = null;
        }

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
        }

        localVideoRef.current.srcObject = null;
        remoteVideoRef.current.srcObject = null;

        setConnected(false);
    }

    return (
        <div className="min-h-screen bg-base-200 p-6 flex flex-col items-center">
            <div className="w-full max-w-5xl">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-2xl font-bold">Doctor ↔ Patient Video Call</h1>
                    <div className="badge badge-info p-3 text-sm">Your ID: {socketId}</div>
                </div>

                <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="card bg-base-100 shadow-xl p-4">
                        <h2 className="font-semibold mb-2 flex items-center gap-2">
                            <User size={18} /> You
                        </h2>
                        <video ref={localVideoRef} autoPlay muted playsInline className="rounded-xl w-full bg-black" />
                    </div>

                    <div className="card bg-base-100 shadow-xl p-4">
                        <h2 className="font-semibold mb-2 flex items-center gap-2">
                            <Video size={18} /> Remote
                        </h2>
                        <video ref={remoteVideoRef} autoPlay playsInline className="rounded-xl w-full bg-black" />
                    </div>
                </div>

                <div className="card bg-base-100 shadow-md p-4">
                    <div className="flex flex-wrap items-center gap-4">
                        <input
                            type="text"
                            placeholder="Enter remote ID"
                            value={remoteId}
                            onChange={(e) => setRemoteId(e.target.value)}
                            className="input input-bordered w-full md:w-60"
                        />

                        <button onClick={callUser} className="btn btn-primary flex items-center gap-2">
                            <Phone size={18} /> Call
                        </button>

                        <button onClick={hangUp} className="btn btn-error flex items-center gap-2">
                            <PhoneOff size={18} /> Hang Up
                        </button>

                        <button onClick={enableLocalStream} className="btn btn-neutral">
                            Start Camera
                        </button>

                        <div className="ml-auto font-semibold">
                            {connected ? (
                                <span className="text-green-600">Connected</span>
                            ) : (
                                <span className="text-gray-500">Not Connected</span>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
