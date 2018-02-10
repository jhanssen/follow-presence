/*global require,process*/

"use strict";

const mqtt = require("mqtt");
const argv = require("minimist")(process.argv.slice(2));
const options = require("./options")(argv, "presence");

const distances = {};
const state = {};

function processDistances(client)
{
    // find the current room for each uuid
    for (let uuid in distances) {
        const old = state[uuid];
        let cur;
        for (let room in distances[uuid]) {
            const canddist = distances[uuid][room];
            if (!cur || cur.distance > canddist) {
                cur = { room: room, distance: canddist };
            }
        }
        if (cur) {
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
        if (!(data.uuid in distances))
            distances[data.uuid] = {};
        distances[data.uuid][topic] = data.distance;

        processDistances(client);
        //console.log(distances);
    });
})();
