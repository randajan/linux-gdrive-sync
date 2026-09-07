import slib, { argv } from "@randajan/simple-lib";

const { isBuild } = argv;

slib(
    isBuild,
    {
        mode: "node",
        rebuildBuffer: 100,
        minify: true,
        loader: {
            ".js": "jsx"
        },
        lib: {

        },
        demo: {

        }
    }
)