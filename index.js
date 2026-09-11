import slib, { argv } from "@randajan/simple-lib";
import ImportGlobPlugin from 'esbuild-plugin-import-glob';



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
        plugins: [
            ImportGlobPlugin.default()
        ],
        lib: {

        },
        demo: {

        }
    }
)