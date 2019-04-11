const path = require('path')

module.exports = {
    entry: "./src/index.ts",
    mode: 'development',
    output: {
        path: path.resolve(__dirname, '../lib/dev'),
        filename: "index.js"
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js", ".json"]
    },
    module: {
        rules: [
            // all files with a '.ts' or '.tsx' extension will be handled by 'ts-loader'
            { test: /\.tsx?$/, use: ["ts-loader"], exclude: /node_modules/ }
        ]
    }
}
