export function formatSecondsToHMS(seconds: number) {  
	let hours = Math.round(seconds / 3600);  
	let minutes = Math.round((seconds % 3600) / 60);  
	let secs =  Math.round(seconds % 60);  

	hours = hours < 10 ? "0" + hours : hours;  
	minutes = minutes < 10 ? "0" + minutes : minutes;  
	secs = secs < 10 ? "0" + secs : secs;  

	return hours + ":" + minutes + ":" + secs;  
}  
