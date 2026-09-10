
import { EventActivity } from "../events/Event";
import { compareNumber } from "../rclone/tools";

export class ActivityFootprints {

    #ttls;
    #map = {
        remote:new Map(),
        local:new Map()
    }

    constructor(ttls={remote:10000, local:5000}) {
        this.#ttls = Object.freeze(ttls);
    }

    createHandler() {
        return this.remember.bind(this);
    }

    #set(map, footprint, ttl) {
        const { path } = footprint;
        map.set(path, Object.freeze(footprint));
        
        setTimeout(_=>this.#unset(map, footprint), ttl).unref?.();
    }

    #unset(map, footprint) {
        const { path } = footprint;
        if (map.get(path) === footprint) { map.delete(path); }
    }

    remember(activity) {
        if (!activity || !(activity instanceof EventActivity)) { return; }
        const { action, side, targetPath, sourcePath } = activity;

        const map = this.#map[side];
        if (!map) { return; }

        const ts = Date.now();
        const ttl = this.#ttls[side];

        if (action === "move" || action === "rename") {
            this.#set(map, { action:"unlink", path:sourcePath, ts }, ttl);
            this.#set(map, { action:"create", path:targetPath, ts }, ttl);
        } else {
            this.#set(map, { action, path:targetPath, ts }, ttl);
        }
    }

    match(side, path, action=undefined, ts=undefined) {
        const map = this.#map[side];
        if (!map) { return; }

        const footprint = map.get(path);
        if (!footprint) { return; }

        if (action && footprint.action !== action) {
            return Object.freeze({ matched:false, mismatch:"action", footprint });
        }

        if (ts && !compareNumber(ts, footprint.ts, 50)) {
            return Object.freeze({ matched:false, mismatch:"ts", footprint });
        }

        map.delete(path);
        return Object.freeze({ matched:true, footprint });
    }

}