/*global require*/

"use strict";

const mqtt = require("mqtt");
const options = require("@jhanssen/options")("presence");

const distances = {};
const state = {};

function room(r) {
    const prefix = "room_presence/";
    if (typeof r === "string" && r.indexOf(prefix) === 0)
        return r.substr(prefix.length);
    return r;
}

function processDistances(client, forcePublish)
{
    // find the current room for each uuid
    for (let uuid in distances) {
        const old = state[uuid];
        let cur;
        for (let r in distances[uuid]) {
            const canddist = distances[uuid][r];
            if (!cur || cur.distance > canddist) {
                cur = { room: room(r), distance: canddist };
            }
        }
        if (forcePublish && cur) {
            const msg = { uuid: uuid, cur: cur.room };
            console.log("force publishing", msg);
            client.publish("follow/presence", JSON.stringify(msg));
        } else if (cur) {
            if (!old || cur.room !== old.room) {
                // emit message
                const oldroom = (old && old.room) || undefined;
                const msg = { uuid: uuid, old: oldroom, cur: cur.room };
                console.log("publishing", msg);
                client.publish("follow/presence", JSON.stringify(msg));
                state[uuid] = cur;
            } else {
                // update old
                old.distance = cur.distance;
            }
        }
    }
}

(function() {
    const url = options("url");
    const opts = options.json("options", {});
    const addOption = name => {
        const v = options(name);
        if (v)
            opts[name] = v;
    };
    addOption("username");
    addOption("password");
    const rooms = (options("rooms") || "").split(";").filter(val => val);
    if (!url) {
        console.error("need a url");
        return;
    }
    if (!rooms.length) {
        console.error("need at least one room");
        return;
    }

    const client = mqtt.connect(url, opts);

    client.once("connect", function () {
        console.log("mqtt connected");
        for (let i = 0; i < rooms.length; ++i) {
            client.subscribe(`room_presence/${rooms[i]}`);
        }
        client.subscribe("follow/presence/command");
    });
    client.once("close", () => {
        console.log("mqtt closed");
        client.end();
    });
    client.on("error", err => {
        console.log("mqtt error", err.message);
        client.end();
    });

    client.on("message", (topic, message) => {
        //console.log(message.toString());
        let data;
        try {
            data = JSON.parse(message);
        } catch (e) {
            return;
        }
        switch (topic) {
        case "follow/presence/command":
            console.log("cmd", data);
            switch (data.command) {
            case "request":
                processDistances(client, true);
                break;
            }
            break;
        default:
            if (!(data.uuid in distances))
                distances[data.uuid] = {};
            distances[data.uuid][topic] = data.distance;

            processDistances(client);
            //console.log(distances);
            break;
        }
    });
})();
