import { createReadStream, createWriteStream, } from "node:fs";
import { access, mkdir, readdir } from "node:fs/promises";
import { basename, extname, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import sharp from "sharp";
/**
 * This util will check if a directory exists & is accessible, if it's not, then it's created fresh.
 * @param dirPath {String|PathLike} - A pre-resolved directory path string
 */
const createDir = async (dirPath) => {
    const directory = resolve(dirPath);
    try {
        await access(directory);
    }
    catch (error) {
        // if 'await access(directory)' fails, then we create the directory
        await mkdir(directory);
    }
};
const isImageType = (filepath) => {
    const supported = ["webp", "png", "jpeg", "jpg", "avif"];
    const name = basename(filepath);
    const ext = extname(filepath);
    const type = name.split(".")[1];
    const isImage = supported.includes(type) || supported.includes(ext);
    return isImage;
};
const getImagesFromDir = async (directory) => {
    const contents = await readdir(directory, { withFileTypes: true });
    const images = contents.filter((item) => {
        const fullPath = join(item.parentPath, item.name);
        return item.isFile() && isImageType(fullPath);
    });
    const fileImages = images.map((item) => ({
        path: join(item.parentPath, item.name),
        name: item.name,
        ext: extname(item.name),
    }));
    return fileImages;
};
const getSharpConverter = (options) => {
    const { resize, format, quality, dimensions } = options;
    const [strWidth, strHeight] = dimensions.split("x");
    const width = Number(strWidth || 100);
    const height = Number(strHeight || 100);
    const dims = { width, height, fit: "contain" };
    switch (format) {
        case "webp": {
            if (!resize)
                return sharp().toFormat("webp");
            return sharp().webp({ quality }).resize(dims);
        }
        case "avif": {
            if (!resize)
                return sharp().toFormat("avif");
            return sharp().avif({ quality }).resize(dims);
        }
        case "jpeg": {
            if (!resize)
                return sharp().toFormat("jpeg");
            return sharp().jpeg({ quality }).resize(dims);
        }
        case "png": {
            if (!resize)
                return sharp().toFormat("png");
            return sharp().png({ quality }).resize(dims);
        }
        default:
            return sharp().toFormat(format);
    }
};
const convertImage = async (inputFile, outputFile, options) => {
    const readable = createReadStream(inputFile);
    const writable = createWriteStream(outputFile);
    const duplex = getSharpConverter(options);
    try {
        await pipeline(readable, duplex, writable);
    }
    catch (error) {
        return error;
    }
};
const sleep = (ms = 800) => {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
};
export { isImageType, getImagesFromDir, getSharpConverter, convertImage, sleep, createDir, };
