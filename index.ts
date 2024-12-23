#!/usr/bin/env node
import inquirer from "inquirer";
import chalk from "chalk";
import {
	convertImage,
	createDir,
	FileInfo,
	FormatOpts,
	getImagesFromDir,
	isImageType,
	sleep,
} from "./utils/utils";
import { basename, resolve, join, extname } from "node:path";
import { UnnamedDistinctQuestion } from "inquirer/dist/commonjs/types";

const log = console.log;

type PromptQuestion<T> = UnnamedDistinctQuestion<T & object> & {
	name: keyof T;
};

interface BaseAnswers {
	inputPath: string;
	outputPath: string;
	format: string;
	resize: boolean;
}
interface ExtraAnswers {
	quality: string;
	dimensions: string;
}
interface Answers {
	inputPath: string;
	outputPath: string;
	format: string;
	resize: boolean;
	quality: string;
	dimensions: string;
}

const intro = async () => {
	log(chalk.blueBright(""));
	log(
		chalk.blueBright(`
	┏┓               
	┃ ┏┓┏┓┓┏┏┓┏┓╋┓┏  
	┗┛┗┛┛┗┗┛┗ ┛ ┗┗┫  
								┛  
			
	`)
	);
	await sleep(500);
	log(chalk.blueBright("...is an image processing and conversion CLI tool."));
	log(
		chalk.blueBright.bold(`
💡 Tips:
	- To convert images in the current directory enter a period for the source folder: .
	- To use the same directory as the source simply press enter on the '(target)' prompt
	- If you just want to convert formats without compression or resize enter 'N' for the resize prompt: n
	`)
	);
};

const getFileName = (file: string, format: FormatOpts["format"]) => {
	const newName = file.split(".")[0] + "." + format;
	return newName;
};

const convertImages = async (
	inputDir: string,
	outputDir: string,
	options: FormatOpts
) => {
	const { format } = options;
	const allImages: FileInfo[] = await getImagesFromDir(inputDir);
	// remove images already in our target format
	const imagesInDir: FileInfo[] = allImages.filter((image) => {
		return !image.name.includes(format);
	});

	if (!imagesInDir || !imagesInDir.length) {
		chalk.red.bold(`No images in directory: \n` + inputDir);
		chalk.red.bold(`Exiting.`);
		process.exit(0);
	}

	// check if dir exists & create it if not
	await createDir(outputDir);

	const promises = imagesInDir.map((image) => {
		const inputFile = resolve(image.path);
		const filename = getFileName(image.name, format);
		const outputFile = join(outputDir, filename);
		return convertImage(inputFile, outputFile, options);
	});

	const allResults = await Promise.all(promises);

	return allResults;
};

const summarizeConversions = (results: Array<any>) => {
	const count = results.length;
	log(chalk.blue.bold(`${count} of ${count} images converted.`));
	log(chalk.greenBright.bold("✅ All done!"));
};

// Prints a summary of the user's choices to stdout
const summarizeAnswers = (answers: Answers) => {
	log("\n");
	log(
		chalk.blue.bold("Source Directory: ") +
			chalk.green.underline(answers.inputPath)
	);
	log(
		chalk.blue.bold("Output Directory: ") +
			chalk.green.underline(answers.outputPath)
	);
	log(
		chalk.blue.bold("Format (convert to this): ") +
			chalk.green.bold(answers.format)
	);
	log("\n");
};

/**
 * Prompts user for:
 * - Input (source) directory
 * - Output (target) directory
 * - Format (target) for the images
 * -- Returns the answers as an object
 */
const promptUser = async (): Promise<Answers> => {
	const basePrompts: PromptQuestion<BaseAnswers>[] = [
		// INPUT PATH (source)
		{
			type: "input",
			name: "inputPath",
			message: "📂: Enter the input directory (source):",
		},
		// OUTPUT PATH (output)
		{
			type: "input",
			name: "outputPath",
			message: "📂: Enter the output directory (target):",
		},
		// IMAGE FORMAT (web|avif|png etc.)
		{
			type: "list",
			name: "format",
			message: "📸: Which format would you like to convert to?",
			choices: ["webp", "avif", "png", "jpg", "jpeg"],
		},
		// RESIZE
		{
			type: "confirm",
			name: "resize",
			message: "📸: Resize images? (y|n)",
			default: false,
		},
	];
	const extraPrompts: PromptQuestion<ExtraAnswers>[] = [
		// QUALITY % (compress quality to eg 90%)
		{
			type: "list",
			name: "quality",
			message:
				"📸: Which quality setting would you prefer? (90% means 10% reduction in size)",
			choices: ["100%", "90%", "85%", "80%", "75%", "70%", "65%"],
			default: "100%",
		},
		// RESIZE DIMENSIONS
		{
			type: "input",
			name: "dimensions",
			message:
				"📸: What resize dimensions should be applied? (Examples: 800x350 or 1200x700)",
			default: "None",
		},
	];

	const baseAnswers = await inquirer
		.prompt<BaseAnswers>(basePrompts)
		.catch((err) => {
			if (err) {
				// log(err);
				log(chalk.red.bold("Aborting."));
				process.exit(1);
			}
			return err;
		});
	const { outputPath } = baseAnswers;
	// if no outputPath is entered, or user presses 'Enter', then use the inputPath
	const output = !outputPath ? baseAnswers.inputPath : outputPath;

	if (baseAnswers.resize) {
		const extraAnswers = await inquirer
			.prompt<ExtraAnswers>(extraPrompts)
			.catch((err) => {
				if (err) {
					// log(err);
					log(chalk.red.bold("Aborting."));
					process.exit(1);
				}
				return err;
			});

		const results: Answers = {
			...baseAnswers,
			...extraAnswers,
			outputPath: output,
		};

		return results;
	} else {
		const results: Answers = {
			...baseAnswers,
			outputPath: output,
			quality: "100%",
			dimensions: "None",
		};

		return results;
	}
};

const runConvertCLI = async () => {
	await intro();
	// run prompts
	const answers: Answers = await promptUser();
	const { inputPath, outputPath, format, quality, resize, dimensions } =
		answers;
	// summarize answers
	summarizeAnswers(answers);
	// execute conversions
	const output = await convertImages(inputPath, outputPath, {
		format: format as FormatOpts["format"],
		quality: Number(quality.replace("%", "") || 100),
		resize: resize,
		dimensions: dimensions,
	});
	// print out summary of conversions
	summarizeConversions(output);
};

// C:\Users\sgore\OneDrive\Pictures\Screenshots\TEST-SHOTS
// C:\Users\sgore\OneDrive\Pictures\Screenshots\LOGO-IDEAS
runConvertCLI().catch((err) => {
	log("Error:" + err);
});
