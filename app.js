const express = require("express");
const app = express();
const indexRouter = require("./routes/index");
const path = require("path");

const socketIO = require("socket.io");
const http = require("http");
const server = http.createServer(app);
const io = socketIO(server);

app.set("view engine", "ejs");
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "src")));

let waitingUsers = [];
let rooms = {};

io.on("connection", function (socket) {
    console.log("New connection:", socket.id);

    socket.on("joinroom", function () {
        if (waitingUsers.length > 0) {
            let partnerId = waitingUsers.shift();
            const roomname = `${socket.id}-${partnerId}`;

            socket.join(roomname);
            io.sockets.sockets.get(partnerId)?.join(roomname);

            rooms[socket.id] = roomname;
            rooms[partnerId] = roomname;

            io.to(roomname).emit("joined", roomname);
        } else {
            waitingUsers.push(socket.id);
        }
    });

    socket.on("signalingMessage", function (data) {
        socket.to(data.room).emit("signalingMessage", data.message);
    });

    socket.on("message", function (data) {
        console.log("Signaling Message:", data);
        socket.to(data.room).emit("message", data.message);
    });

    socket.on("startVideoCall", function ({ room }) {
        socket.to(room).emit("incomingCall");
    });

    socket.on("acceptCall", function ({ room }) {
        socket.to(room).emit("callAccepted");
    });

    socket.on("rejectCall", function ({ room }) {
        socket.to(room).emit("callRejected");
    });

    socket.on("disconnect", function () {
        let index = waitingUsers.indexOf(socket.id);
        if (index !== -1) {
            waitingUsers.splice(index, 1);
        }

        let roomname = rooms[socket.id];
        if (roomname) {
            socket.to(roomname).emit("partnerDisconnected");
            delete rooms[socket.id];
        }
    });
});

app.use("/", indexRouter);

server.listen(process.env.PORT||3000);
