/*global require,module,process*/

const fs = require("fs");
const path = require("path");
const homedir = require("homedir");

class Options {
    constructor(argv, prefix) {
        this.argv = argv;
        this.prefix = prefix ? (prefix + "-") : "";

        this._readFile(prefix);
    }

    value(name) {
        // foo-bar becomes FOO_BAR as env
        if (name in this.argv)
            return this.argv[name];
        const envname = (this.prefix + name).replace(/-/g, "_").toUpperCase();
        if (envname in process.env)
            return process.env[envname];
        return undefined;
    }

    _readFile(prefix) {
        // if we have a config file passed, read it
        const file = this.value("config-file") || prefix;
        if (typeof file === "string" && file.length > 0) {
            const read = file => {
                let data;
                try {
                    data = fs.readFileSync(file, "utf8");
                } catch (e) {
                }
                return data;
            };

            let data;
            if (path.isAbsolute(file)) {
                data = read(file);
            } else {
                [".", path.join(homedir(), ".config"), `/etc`].forEach(root => {
                    if (!data) {
                        data = read(path.join(root, file));
                    }
                    if (!data) {
                        data = read(path.join(root, file) + ".conf");
                    }
                });
            }
            if (typeof data === "string") {
                // entries of key=value
                const items = data.split("\n");
                for (let i = 0; i < items.length; ++i) {
                    const item = items[i].trim();
                    if (!item.length)
                        continue;
                    if (item[0] === "#")
                        continue;
                    const eq = item.indexOf("=");
                    if (eq === -1)
                        continue;
                    const key = item.substr(0, eq).trim();
                    if (!key.length)
                        continue;
                    if (!(key in this.argv)) {
                        this.argv[key] = item.substr(eq + 1).trim();
                    }
                }
            }
        }
    }
}

const data = {};

module.exports = function(argv, prefix) {
    data.options = new Options(argv, prefix);
    let ret = function(name) {
        return data.options.value(name);
    };
    ret.int = function(name, defaultValue) {
        const v = parseInt(data.options.value(name));
        if (typeof v === "number" && !isNaN(v))
            return v;
        return defaultValue;
    };
    ret.json = function(name, defaultValue) {
        const opt = data.options.value(name);
        if (!opt)
            return defaultValue;
        try {
            const json = JSON.parse(opt);
            return json;
        } catch (e) {
        }
        return defaultValue;
    };
    return ret;
};
