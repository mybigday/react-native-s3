import snakeCase from "snake-case"; 

export const normalizeFilePath = path =>
	path.startsWith("file://") ? path.slice(7) :
	path;

export const snakeCaseKeys = obj => {
	const result = {};
	Object.keys(obj).forEach(key => {
		result[snakeCase(key)] = obj[key];
	});
	return result;
};
