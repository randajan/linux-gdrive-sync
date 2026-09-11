import { ActivityParser } from "./ActivityParser"
import * as bisyncParsers from "./parsers/bisync/*.js";
import { importFiles } from "@randajan/simple-lib/fs";

const bisync = importFiles( bisyncParsers, {
    prefix:"./parsers/bisync/",
    suffix:".js",
    trait:(file)=>file
});

export const createBisyncActivityParser = (localPath, remoteName, onActivity)=>{
    return new ActivityParser(bisync, localPath, remoteName, onActivity);
}