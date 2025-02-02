
export function formatSecondsToHMS(seconds: number) {  
	let hours: number | string = Math.round(seconds / 3600);  
	let minutes: number | string = Math.round((seconds % 3600) / 60);  
	let secs: number | string =  Math.round(seconds % 60);  

	hours = hours < 10 ? "0" + hours : hours;  
	minutes = minutes < 10 ? "0" + minutes : minutes;  
	secs = secs < 10 ? "0" + secs : secs;  

	return hours + ":" + minutes + ":" + secs;  
}  


export function convertToSeconds(timeString: string) {  
	// 使用正则表达式匹配小时、分钟、秒和毫秒  
	const match = timeString.match(/^(\d{2}):(\d{2}):(\d{2})\.(\d{2})$/);  
	if (!match) {  
			throw new Error('Invalid time format. Expected HH:MM:SS.mm');  
	}  

	// 提取小时、分钟、秒和毫秒  
	const hours = parseInt(match[1], 10);  
	const minutes = parseInt(match[2], 10);  
	const seconds = parseInt(match[3], 10);  
	const milliseconds = parseInt(match[4], 10);  

	// 将时间单位转换为秒并相加  
	const totalSeconds = (hours * 3600) + (minutes * 60) + seconds + (milliseconds / 100);  
	return totalSeconds;  
} 


export const toBase64 = (blob) => {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(blob);
		reader.onloadend = () => {
			resolve(reader.result);
		};
		reader.onerror = reject;
	});
};