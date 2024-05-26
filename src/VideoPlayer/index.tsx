import { useEffect, useRef, useState } from 'react'
import './index.css'
import { FFmpeg } from '@ffmpeg/ffmpeg'
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import GlobalLoading from '../GlobalLoading';
import { formatSecondsToHMS } from '../uitl';

function generateUUID() {
	return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
		let r = (Math.random() * 16) | 0,
			v = c === 'x' ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}
const getId = () => {
	return generateUUID()
}
let orginVideoName = 'orginVideoName'
let runVideoInfo = {}
const minsecondes = 4 // 最小秒数
const VideoPlayer = () => {
	const videoRef = useRef<HTMLElement>(null)
	const timeLineRef = useRef<HTMLElement>(null)
	const zoomRef = useRef<HTMLElement>(null)
	const zoomMaskRef = useRef<HTMLElement>(null)
	const plyrVideoRef = useRef<HTMLElement>(null)
	const ffmpegRef = useRef({
		ffmpeg: new FFmpeg(),
		videoInfo: {},
		scaleInfo: {}
	});

	const timeRef = useRef(0)

	const mouseEvent = useRef({
		status: 1,
		time: 0,
		isDrag: false,
		direction: 'left',
		dragIndex: 0,
		minWidth: 10,
		cacheLeft: 0,
		cacheWidth: 0,
		targetDom: null,
	})
	const [progressInfo, setProgressInfo] = useState({
		current: 0,
		move: 0,
	})
	const [zoomMaskInfo, setZoomMaskInfo] = useState({
		current: 0,
		status: true,
		width: 0,
	})

	const [loadInfo, setLoadInfo] = useState({
		isLoading: false,
		message: 'load ffmpeg'
	})

	const [playInfo, setPlayInfo] = useState({
		playing: false,
		status: false,
		update: false,
	})

	const [attentionEyesInfo, setAttentionEyesInfo] = useState({
		selectIndex: -1,
		left: 0,
		top: 0,
		scale: 0.05,
	})


	const [zoomDatas, setZoomDatas] = useState([])

	const [downUrl, setDownUrl] = useState('')

	const initLoadFFmpeg = async () => {

		const baseURL = "https://unpkg.com/@ffmpeg/core-mt@0.12.6/dist/esm";
		const ffmpeg = new FFmpeg()
		ffmpeg.on("progress", ({ progress, time }) => {
			console.log('progress-----', progress, time);
		})
		ffmpeg.on("log", ({ message, type }) => {
			console.log('log------', message, type);
			if (message.includes('Duration')) {
				runVideoInfo.duration = message.slice(
					message.indexOf('Duration:') + 'Duration: '.length,
					message.indexOf(',')
				)
				runVideoInfo.bitRate = message.slice(
					message.indexOf('bitrate:') + 'bitrate: '.length
				)
			}

			if (message.includes('Stream #') && message.includes('progressive),') && type === 'stderr') {
				const messages = message.split('progressive),')
				if (messages.length >= 2) {
					messages[1].split(', ').forEach(v => {
						if (/([0-9]+)x([0-9]+)/.test(v)) {
							runVideoInfo.width = v.trim().split('x')[0]
							runVideoInfo.height = v.trim().split('x')[1].trim().split(' ')[0]
						} else if (/([0-9]+) fps/.test(v.trim())) {
							runVideoInfo.fps = v.trim().split(' fps')[0]
						}
					})
				}
			}

		});
		// toBlobURL is used to bypass CORS issue, urls with the same
		// domain can be used directly.
		await ffmpeg.load({
			coreURL: await toBlobURL(`./plugin/ffmpeg-core.js`, "text/javascript"),
			wasmURL: await toBlobURL(
				`./plugin/ffmpeg-core.wasm`,
				"application/wasm"
			),
			workerURL: await toBlobURL(
				`./plugin/ffmpeg-core.worker.js`,
				"text/javascript"
			),
		});
		console.log('加载完成')
		ffmpegRef.current.ffmpeg = ffmpeg
		setLoadInfo({ isLoading: false, message: 'Load FFmpeg' })
	}

	useEffect(() => {
		setLoadInfo({ isLoading: true, message: 'Load FFmpeg' })
		initLoadFFmpeg()
	}, [])

	useEffect(() => {

		const handleClick = (e) => {
			console.log('e----', e)
			if (attentionEyesInfo.selectIndex < 0) return
			// update scale
			if (!e.target.className.includes('zoom-setting')) {
				setAttentionEyesInfo((per) => {
					return {
						...per,
						left: e.offsetX,
						top: e.offsetY,
					}
				})
			}
			if (timeRef.current) clearTimeout(timeRef.current)
			timeRef.current = setTimeout(() => {
				const newZoomDatas = [...zoomDatas]
				newZoomDatas[attentionEyesInfo.selectIndex] = {
					...newZoomDatas[attentionEyesInfo.selectIndex],
					x: attentionEyesInfo.left,
					y: attentionEyesInfo.top,
					vx: ffmpegRef.current.scaleInfo.scaleX * attentionEyesInfo.left,
					vy: ffmpegRef.current.scaleInfo.scaleY * attentionEyesInfo.top,
					vscale: attentionEyesInfo.scale,
				}
				setZoomDatas([...newZoomDatas])
				console.log('newZoomDatas---', newZoomDatas);
			}, 500);
		}
		if (plyrVideoRef.current) {
			plyrVideoRef.current.addEventListener('click', handleClick)
		}
		return () => {
			if (plyrVideoRef.current) {
				plyrVideoRef.current.removeEventListener('click', handleClick)
			}
		}
	}, [attentionEyesInfo])

	useEffect(() => {

		const handleDocumentClick = (e) => {
			console.log(e)
			if (!e.target.parentNode.className.includes('plyr--video')
				&& !e.target.className.includes('zoom-item')
				&& !e.target.parentNode.className.includes('dropdown')) {
				setAttentionEyesInfo((per) => {
					return {
						...per,
						selectIndex: -1,
					}
				})
			}
		}
		document.addEventListener('click', handleDocumentClick)
		return () => {
			document.removeEventListener('click', handleDocumentClick)
		}
	}, [])

	useEffect(() => {
		const onMouseMove = (e: MouseEvent) => {
			const mod = timeLineRef.current?.clientWidth / 0.9 * 0.1 * 0.5
			let moveValue = ((e.clientX - mod) / (timeLineRef.current?.clientWidth)) * 100
			moveValue = moveValue < 0 ? 0 : (moveValue > 100 ? 100 : moveValue)
			setProgressInfo(per => {
				return {
					...per,
					move: moveValue
				}
			})
		}

		const onMouseDown = (e) => {
			const { target } = e
			if (target.className.includes('zoom-item-left') || target.className.includes('zoom-item-right')) return;

			setProgressInfo(per => {
				videoRef.current.currentTime = videoRef.current.duration * per.move / 100
				// console.log('videoRef.current.currentTime---', videoRef.current.currentTime)
				return {
					...per,
					current: per.move
				}
			})
		}

		if (timeLineRef.current) {
			timeLineRef.current.addEventListener('mousemove', onMouseMove)
			timeLineRef.current.addEventListener('mousedown', onMouseDown)
		}
		return () => {
			if (timeLineRef.current) {
				timeLineRef.current.removeEventListener('mousemove', onMouseMove);
				timeLineRef.current.removeEventListener('mousedown', onMouseDown);
			}
		}
	}, [])

	useEffect(() => {
		const onMouseMove = (e: MouseEvent) => {
			const { target } = e;
			const mod = zoomRef.current?.clientWidth / 0.9 * 0.1 * 0.5
			let moveValue = ((e.clientX - mod) / (zoomRef.current?.clientWidth)) * 100
			moveValue = moveValue < 0 ? 0 : (moveValue > 100 ? 100 : moveValue)
			const { isDrag, dragIndex, minWidth, direction, cacheLeft, cacheWidth, time, status } = mouseEvent.current
			if (status === 1 && time) {
				// clearTimeout(time)
				mouseEvent.current.status = 0
				return
			}
			const lastValue = cacheLeft + cacheWidth
			if (isDrag) {
				showZoomMask(false);
				if (direction === 'right') {
					const left = zoomDatas[dragIndex].left
					let width = moveValue - left;
					width = width > minWidth ? width : minWidth
					width = width <= 0 ? 0 : width
					const cpzoomDatas = [...zoomDatas]
					cpzoomDatas.sort((a, b) => a.left - b.left)
					for (let i = 0; i < cpzoomDatas.length; i++) {
						if (i !== dragIndex
							&& left < cpzoomDatas[i].left) {
							if (width + left >= cpzoomDatas[i].left) {
								width = cpzoomDatas[i].left - left
							}
							break
						}
					}
					setZoomDatas(per => {
						per[dragIndex].width = width
						return [...per]
					})
				} else if (direction === 'left') {
					const left = zoomDatas[dragIndex].left
					let nwmoveValue = moveValue >= lastValue - minWidth ? lastValue - minWidth : moveValue;
					const cpzoomDatas = [...zoomDatas]
					cpzoomDatas.sort((a, b) => (b.left + b.width) - (a.left + a.width))
					for (let i = 0; i < cpzoomDatas.length; i++) {
						if (i !== dragIndex
							&& left > cpzoomDatas[i].left) {
							if (nwmoveValue <= cpzoomDatas[i].left + cpzoomDatas[i].width) {
								nwmoveValue = cpzoomDatas[i].left + cpzoomDatas[i].width
							}
							break
						}
					}
					let nwidth = lastValue - nwmoveValue
					nwidth = nwidth > minWidth ? nwidth : minWidth
					setZoomDatas(per => {
						per[dragIndex].width = nwidth
						per[dragIndex].left = nwmoveValue
						return [...per]
					})
				}
			} else {
				showZoomMask(true);
			}

			// than 100%
			if (moveValue + mouseEvent.current.minWidth > 100) {
				showZoomMask(false)
			}

			// in zoom-item 
			if (target.className.includes('zoom-item')) {
				showZoomMask(false);
			}
			// range zoomdatas
			for (let i = 0; i < zoomDatas.length; i++) {
				const postion = moveValue + zoomMaskInfo.width
				const { left, width } = zoomDatas[i]
				if (postion >= left && postion <= left + width) {
					showZoomMask(false)
					break
				}
			}

			setZoomMaskInfo(per => {
				return {
					...per,
					current: moveValue
				}
			})
		}
		const onMouseDown = (e) => {
			const { target } = e
			if (target.className.includes('zoom-mark')) {
				if (!getMaskStatus() || videoRef.current.duration < 2) return;
				setPlayInfo((per) => {
					return {
						...per,
						update: true,
					}
				})
				// add  zoom
				setZoomDatas(per => {
					return [
						...per,
						{
							id: getId(),
							left: zoomMaskInfo.current,
							width: mouseEvent.current.minWidth,
							x: videoRef.current?.clientWidth / 2,
							y: videoRef.current?.clientHeight / 2,
							vx: ffmpegRef.current.videoInfo.width,
							vy: ffmpegRef.current.videoInfo.height,
							vscale: 0.05,
						}
					]
				})
				showZoomMask(false)
			} else if (target.className.includes('zoom-item-right')) {
				// drag right
				mouseEvent.current.status = 1
				showZoomMask(false)
				mouseEvent.current.time = setTimeout(() => {
					mouseEvent.current.isDrag = true
					mouseEvent.current.direction = 'right'
					mouseEvent.current.dragIndex = target.dataset['index']
					mouseEvent.current.cacheLeft = zoomDatas[target.dataset['index']].left
					mouseEvent.current.cacheWidth = zoomDatas[target.dataset['index']].width
					mouseEvent.current.status = 0
				}, 0);
			} else if (target.className.includes('zoom-item-left')) {
				// drag left
				showZoomMask(false)
				mouseEvent.current.status = 1
				mouseEvent.current.time = setTimeout(() => {
					mouseEvent.current.isDrag = true
					mouseEvent.current.direction = 'left'
					mouseEvent.current.dragIndex = target.dataset['index']
					mouseEvent.current.cacheLeft = zoomDatas[target.dataset['index']].left
					mouseEvent.current.cacheWidth = zoomDatas[target.dataset['index']].width
					mouseEvent.current.targetDom = target
					mouseEvent.current.status = 0
				}, 0);
			} else if (target.className.includes('zoom-item')) {
				// select zoom
				const index = target.dataset['index']
				const item = zoomDatas[index]
				setAttentionEyesInfo({
					selectIndex: index,
					left: item.x,
					top: item.y,
					scale: item.vscale,
				})
			}
		}
		const onMouseUp = () => {
			mouseEvent.current.isDrag = false
		}

		const onMouseLeave = () => {
			showZoomMask(false)
			mouseEvent.current.isDrag = false;
		}

		if (zoomRef.current) {
			zoomRef.current.addEventListener('mousemove', onMouseMove)
			zoomRef.current.addEventListener('mousedown', onMouseDown)
			zoomRef.current.addEventListener('mouseup', onMouseUp)
			zoomRef.current.addEventListener('mouseleave', onMouseLeave)
		}
		return () => {
			if (zoomRef.current) {
				zoomRef.current.removeEventListener('mousedown', onMouseDown)
				zoomRef.current.removeEventListener('mousemove', onMouseMove)
				zoomRef.current.removeEventListener('mouseup', onMouseUp)
				zoomRef.current.removeEventListener('mouseleave', onMouseLeave)
			}
		}
	}, [zoomMaskInfo, zoomDatas])


	const initMouseEvent = () => {
		const width = timeLineRef.current?.clientWidth
		const duration = videoRef.current.duration
		const scale = width / duration
		console.log('mouseEvent.current.minWidth---- 0', mouseEvent.current.minWidth)
		mouseEvent.current.minWidth = (scale * minsecondes) / width * 100
		console.log('mouseEvent.current.minWidth---- 1', scale, duration, mouseEvent.current.minWidth)
		if (zoomDatas.length) {
			console.log('zoomDatas-----', zoomDatas, scale)
		}
		setZoomMaskInfo(per => {
			return {
				...per,
				width: mouseEvent.current.minWidth
			}
		})
	}
	useEffect(() => {
		const updateScrubber = () => {
			requestAnimationFrame(() => {
				const time = videoRef.current.currentTime
				const duration = videoRef.current.duration
				let position = (time / duration) * 100
				if (time === 0) {
					position = 0
				}
				setProgressInfo(per => {
					return {
						...per,
						current: position
					}
				})
			})
		}
		const handelEnded = () => {
			setPlayInfo((per) => {
				return {
					...per,
					playing: false,
				}
			})
		}
		const handleLoadedmetadata = () => {
			console.log('handleLoadedmetadata-----',)
			initMouseEvent()
		}
		const handleLoadstart = () => { }
		if (videoRef.current) {
			videoRef.current.addEventListener('timeupdate', updateScrubber)
			videoRef.current.addEventListener('ended', handelEnded)
			videoRef.current.addEventListener('loadedmetadata', handleLoadedmetadata)
			videoRef.current.addEventListener('loadstart', handleLoadstart)

		}
		return () => {
			if (videoRef.current) {
				videoRef.current.removeEventListener('timeupdate', handelEnded)
				videoRef.current.removeEventListener('ended', handelEnded)
				videoRef.current.addEventListener('loadedmetadata', handleLoadedmetadata)
				videoRef.current.removeEventListener('loadstart', handleLoadstart)
			}
		}
	}, [])

	const showZoomMask = (status: boolean) => {
		if (zoomMaskRef.current) {
			zoomMaskRef.current.style.opacity = status ? '1' : '0';
		}
	}
	const getMaskStatus = () => {
		if (zoomMaskRef.current) {
			return zoomMaskRef.current.style.opacity === String(1);
		}
		return true
	}

	const initVideo = async (ffmpeg: any, video: Blob) => {
		const nwOrginVideoName = getId()
		await ffmpeg.writeFile(orginVideoName, await fetchFile(video))
		// const com1 = `-v error -select_streams v:0 -show_entries stream=width,height -of default=noprint_wrappers=1:nokey=1 ${orginVideoName}`
		await ffmpeg.exec(['-i', orginVideoName])
		console.log('runVideoInfo====', JSON.stringify(runVideoInfo));
		const video1 = await ffmpeg.readFile(orginVideoName)
		const videoUrl1 = URL.createObjectURL(
			new Blob([video1.buffer], { type: 'video/mp4' })
		)
		console.log('videoUrl1 0--', videoUrl1)
		const com2 = `-i ${orginVideoName} -vf zoompan=d=1:fps=${runVideoInfo.fps}:s=hd1080 -c:v libx264 -crf 23 ${nwOrginVideoName}.mp4`
		await ffmpeg.exec(com2.split(' ').filter(v => v !== ''))
		const video0 = await ffmpeg.readFile(`${nwOrginVideoName}.mp4`)
		const videoUrl = URL.createObjectURL(
			new Blob([video0.buffer], { type: 'video/mp4' })
		)
		orginVideoName = nwOrginVideoName
		console.log('videoUrl 1---', videoUrl)
		return videoUrl
	}
	const onFileChange = async (event) => {
		setLoadInfo({ isLoading: true, message: 'Load Video' })
		const file = event.target.files[0]
		const url = await initVideo(ffmpegRef.current.ffmpeg, file)
		videoRef.current.src = url
		const blobUrl = URL.createObjectURL(file)
		ffmpegRef.current.videoInfo = { blobUrl, ...runVideoInfo }
		ffmpegRef.current.scaleInfo = {
			scaleX: runVideoInfo.width / (videoRef.current?.clientWidth),
			scaleY: runVideoInfo.height / (videoRef.current?.clientHeight),
		}
		setPlayInfo({
			playing: false,
			status: true,
			update: false,
		})
		runVideoInfo = {}
		setZoomDatas([])
		console.log(ffmpegRef.current)
		event.target.value = ''
		setLoadInfo({ isLoading: false, message: 'Load Video' })
	}

	const onVideoPlay = () => {
		!playInfo.playing ? videoRef.current?.play() : videoRef.current?.pause()
		setPlayInfo(per => {
			return {
				...per,
				playing: !playInfo.playing
			}
		})
	}

	const onDeleteZoomItem = () => {
		if (attentionEyesInfo.selectIndex < 0) return
		const newDatas = [...zoomDatas]
		newDatas.splice(attentionEyesInfo.selectIndex, 1)
		setZoomDatas(newDatas)
		setAttentionEyesInfo((per => {
			return {
				...per,
				selectIndex: -1
			}
		}))
	}

	const getFrames = () => {
		const newDatas = [...zoomDatas]
		newDatas.sort((a, b) => a.left - b.left)
		const duration = videoRef.current.duration
		const frames = []
		// const scaleX = ffmpegRef.current.videoInfo.width / videoRef.current?.clientWidth
		// const scaleY = ffmpegRef.current.videoInfo.height / videoRef.current?.clientHeight
		const fps = ffmpegRef.current.videoInfo.fps
		for (let i = 0; i < newDatas.length; i++) {
			const { left, width, x, y, vx, vy, vscale } = newDatas[i]
			if (i === 0 && left > 0) {
				frames.push({
					ss: formatSecondsToHMS(0),
					t: formatSecondsToHMS(left / 100 * duration),
					out: `${getId()}`,
					fps,
					d: Math.round(left / 100 * duration),
				})
			}
			// 对焦
			frames.push({
				ss: formatSecondsToHMS(left / 100 * duration),
				t: formatSecondsToHMS(width / 100 * duration),
				out: `${getId()}`,
				width: ffmpegRef.current.videoInfo.width,
				height: ffmpegRef.current.videoInfo.height,
				fps,
				d: Math.round(width / 100 * duration),
				status: 1,
				vx,
				vy,
				vscale,
			})
			// 还原
			// frames.push({ 
			// 	ss: formatSecondsToHMS(left / 100 * duration + 1), 
			// 	t: formatSecondsToHMS( width /100 * duration / 2), 
			// 	out: `${getId()}`,
			// 	x: scaleX * x,
			// 	y: scaleY * y,
			// 	width: ffmpegRef.current.videoInfo.width,
			// 	height: ffmpegRef.current.videoInfo.height,
			// 	fps,
			// 	d: width / 100 * duration,
			// 	status: '2'
			// })
			if (newDatas[i + 1]) {
				const nextLeft = newDatas[i + 1].left
				frames.push({
					ss: formatSecondsToHMS((left + width) / 100 * duration),
					t: formatSecondsToHMS((nextLeft - (left + width)) / 100 * duration),
					out: `${getId()}`,
					d: Math.round((nextLeft - (left + width)) / 100 * duration),
					fps,
				})
			} else {
				frames.push({
					ss: formatSecondsToHMS((left + width) / 100 * duration),
					t: formatSecondsToHMS(duration - (left + width) / 100 * duration),
					out: `${getId()}`,
					d: Math.round(duration - (left + width) / 100 * duration),
					fps,
				})
			}
		}
		return frames;
	}
	const onSaveFrame = async () => {
		console.log(zoomDatas, ffmpegRef.current.videoInfo)
		// -ss 00:00:10 -t 00:00:30 -vcodec copy -acodec copy output.mp4
		// { ss:, t:, out:}
		setLoadInfo({ isLoading: true, message: 'Processing' })
		const frames = getFrames()
		console.log('frames===', frames)
		const { ffmpeg, videoInfo } = ffmpegRef.current
		ffmpeg.writeFile(orginVideoName, await fetchFile(videoInfo.blobUrl))
		let coms = ``
		frames.forEach(({ ss, t, out }) => {
			coms = `${coms} -ss ${ss} -t ${t}  -c:v libx264 -crf 23 -c copy ${out}.mp4 `
		})
		await ffmpeg.exec(['-i', orginVideoName, ...(coms.split(' '))].filter(v => v !== ''))
		// console.log(['-i', orginVideoName, ...(coms.split(' '))])
		// const command1 = `-i part1.mp4 -vf  zoompan=z=\'min(pzoom+0.05,2)\':x=0:y=0:d=1:fps=${fps},scale=${width}:${height} output3.mp4`
		coms = ''
		for (let i = 0; i < frames.length; i++) {
			const { fps, width, height, out, d, vx, vy, status, vscale = 0.05 } = frames[i]
			const video = await ffmpeg.readFile(`${out}.mp4`)
			const videoUrl = URL.createObjectURL(
				new Blob([video.buffer], { type: 'video/mp4' })
			)

			console.log('videoUrl--- ', i, frames[i], videoUrl)
			if (fps && width && height && status) {
				const newOut = `${getId()}`
				// if (status === '1') {
				// 	coms = `-i ${out}.mp4 -vf zoompan=z=\'min(pzoom+0.5,2)\':x=0:y=0:d=1:fps=${fps} ${newOut}.mp4`
				// } else {
				// 	coms = `-i ${out}.mp4 -vf zoompan=z=\'max(1,pzoom-0.05)\':s=${width}x${height}:x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=1:fps=${fps} ${newOut}.mp4`
				// }
				// const zoomExpression = 'max(1.5,pzoom+0.05),if(gte(out_time, 1),zoom,)'; 
				const zoomExpression = `if(lt(in_time,2),pzoom+${vscale},if(gte(out_time,${d - 2}),pzoom-${vscale},pzoom))`
				// const zoomExpression = `if(between(in_time,${d-1},${d}),max(1,pzoom-0.05),if(lte(pzoom,1.5),pzoom+0.05,pzoom))`;
				console.log('d------- 总共多少秒', d, zoomExpression)
				coms = `-i ${out}.mp4 -vf zoompan=z=\'${zoomExpression}\':x=\'${vx}/2-(${vx}/zoom/2)\':y=\'${vy}/2-(${vy}/zoom/2)\':d=${2}:fps=${fps}:s=hd1080 -t ${d} -codec:v libx264 -crf 23 ${newOut}.mp4`
				console.log('coms--', coms)
				await ffmpeg.exec([...(coms.split(' '))].filter(v => v !== ''))
				const video = await ffmpeg.readFile(`${newOut}.mp4`)
				const videoUrl = URL.createObjectURL(
					new Blob([video.buffer], { type: 'video/mp4' })
				)
				await ffmpeg.writeFile(`${newOut}_0`, await fetchFile(videoUrl))
				console.log('videoUrl zoompan--- 秒', d, videoUrl)

				// const newOut1 = `${getId()}`
				// coms = `-i ${newOut}_0 -vf scale=${width}x${height}  -t ${d}  ${newOut1}.mp4`
				// await ffmpeg.exec([...(coms.split(' '))].filter(v => v !== ''))
				// const video1 = await ffmpeg.readFile(`${newOut1}.mp4`)
				// const videoUrl1 = URL.createObjectURL(
				// 	new Blob([video1.buffer], { type: 'video/mp4' })
				// )
				// await ffmpeg.writeFile(`${newOut1}_0`, await fetchFile(videoUrl1))
				// console.log('scale----', videoUrl1)
				frames[i].out = newOut

			} else {
				// await ffmpeg.writeFile(`${out}_0`, await fetchFile(videoUrl))
				const newOut = `${getId()}`
				coms = `-i ${out}.mp4 -vf zoompan=z='zoom':x=\'iw/2-(iw/zoom/2)\':y=\'ih/2-(ih/zoom/2)\':d=1:fps=${fps}:s=hd1080 -t ${d} -codec:v libx264 -crf 23 ${newOut}.mp4`
				await ffmpeg.exec([...(coms.split(' '))].filter(v => v !== ''))
				const video = await ffmpeg.readFile(`${newOut}.mp4`)
				const videoUrl = URL.createObjectURL(
					new Blob([video.buffer], { type: 'video/mp4' })
				)
				await ffmpeg.writeFile(`${newOut}_0`, await fetchFile(videoUrl))
				frames[i].out = newOut
				console.log('videoUrl scale---', videoUrl)
			}
		}
		coms = ''
		// -i "concat:input1.mp4|input2.mp4|input3.mp4" output.mp4
		// for (let i = 0 ; i < frames.length; i++) { 
		// 		const { out } = frames[i]
		// 		const { width, height } = ffmpegRef.current.videoInfo
		// 		console.log(width, height, out)
		// 		if (i === 1) continue
		// 		const video = await ffmpeg.readFile(`${out}.mp4`)
		// 		const videoUrl = URL.createObjectURL(
		// 			new Blob([video.buffer], { type: 'video/mp4' })
		// 		)
		// 		await ffmpeg.writeFile(`${out}_3.mp4`, await fetchFile(videoUrl))
		// 		// 缩放
		// 		const command2 = `-i ${out}_3.mp4 -vf scale=${width}:${height} ${out}_s.mp4`
		// 		await ffmpeg.exec([...(command2.split(' '))].filter(v => v !== ''))
		// 		const video1 = await ffmpeg.readFile(`${out}_s.mp4`)
		// 		const videoUrl1 = URL.createObjectURL(
		// 			new Blob([video1.buffer], { type: 'video/mp4' })
		// 		)
		// 		await ffmpeg.writeFile(`${out}_c.mp4`, await fetchFile(videoUrl1))
		// 		console.log('videoUrl___', width, height, videoUrl)
		// 		concats.push(`${out}_c.mp4`)
		// 		cmI = `${cmI} -i ${out}_c.mp4 `
		// }

		// [0:v:0][0:a:0][1:v:0][1:a:0]

		// const video0 = await ffmpeg.readFile(`${frames[1].out}_0`)
		// const videoUrl0 = URL.createObjectURL(
		// 	new Blob([video0.buffer], { type: 'video/mp4' })
		// )
		// console.log('videoUrl0---', videoUrl0);

		// coms = `${cmI} -filter_complex [0:v:0][0:a:0][1:v:0][1:a:0][2:v:0][2:a:0]concat=n=3:v=1:a=1[outv][outa] -map [outv] -map [outa] output.mp4`
		let filelist = ``
		for (let i = 0; i < frames.length; i++) {
			filelist = `${filelist}file ${frames[i].out}_0\n`
		}
		const fileList = `${getId()}.txt`
		await ffmpeg.writeFile(fileList, filelist);
		console.log('filelist----', filelist)
		const command2 = `-f concat -i ${fileList}  -c copy output4.mkv`
		// const command2 = `-i ${frames[0].out}_0 -i ${frames[2].out}_0 -filter_complex [0:v:0][0:a:0][1:v:0][1:a:0]concat=n=2:v=1:a=1[v][a] -map [v] -map [a] output4.mp4`
		// coms = `-i concat:${concats.join('|')} output.mp4`
		console.log('command2---', command2)
		await ffmpeg.exec([...(command2.split(' '))].filter(v => v !== ''))
		console.log('output4 -----')
		const video3 = await ffmpeg.readFile(`output4.mkv`)
		const video3Url = URL.createObjectURL(
			new Blob([video3.buffer], { type: 'video/mp4' })
		)
		videoRef.current.src = video3Url
		setDownUrl(video3Url)
		console.log(frames, video3Url, ffmpegRef.current, videoRef.current.duration, JSON.stringify(runVideoInfo))
		setLoadInfo({ isLoading: false, message: 'Processing' })
	}

	const onScaleChange = (e) => {
		setAttentionEyesInfo((per) => {
			return {
				...per,
				scale: e.target.value / 100
			}
		})
	}

	const onDownLoad = async () => {
		if (!downUrl) return;
		// -i input.mkv -c copy output.mp4
		const { ffmpeg } = ffmpegRef.current
		await ffmpeg.writeFile(`avcraft_0`, await fetchFile(downUrl))
		const command2 = `-i avcraft_0 -c copy avcraft.mp4`
		await ffmpeg.exec([...(command2.split(' '))].filter(v => v !== ''))
		const video3 = await ffmpeg.readFile(`avcraft.mp4`)
		const video3Url = URL.createObjectURL(
			new Blob([video3.buffer], { type: 'video/mp4' })
		)
		// 创建一个隐藏的<a>元素  
		const a = document.createElement('a');
		a.href = video3Url;
		a.download = 'avcraft.mp4'; // 设置下载的文件名  

		// 模拟点击<a>元素来触发下载  
		document.body.appendChild(a); // 这一步是必要的，因为某些浏览器（如Firefox）需要元素在DOM中才能触发下载  
		a.click();

		// 清理URL对象  
		URL.revokeObjectURL(url); // 释放内存  

		// 从DOM中移除<a>元素（可选）  
		document.body.removeChild(a);
	}
	return <>
		<GlobalLoading {...loadInfo} ></GlobalLoading>
		<div className="videoPlayer">
			<div className="playerWrap">
				<div className="plyr--video" ref={plyrVideoRef}>
					<div className="desc"> Upload Video</div>
					<video className="ply-video" src="" ref={videoRef}></video>
					<div className="dropdown" style={{ left: `${attentionEyesInfo.left}px`, top: `${attentionEyesInfo.top}px`, display: attentionEyesInfo.selectIndex > -1 ? 'block' : 'none' }}>
						<div className="attention-eyes" > </div>
						<div className="dropdown-opreation">
							<input type="range" onChange={onScaleChange} value={attentionEyesInfo.scale * 100} min={1} max={10} className="zoom-setting"></input>
						</div>
					</div>

				</div>
			</div>
			<div className="control">
				<div className="operation">
					<div style={{ display: 'flex', }}>
						<button className="button default">
							<label htmlFor="upload">上传视频</label>
							<input type="file" id="upload" accept="video/*" onChange={onFileChange} style={{ display: 'none' }} ></input>
						</button>
						<button className="button default" onClick={onVideoPlay} disabled={!playInfo.status}>
							{playInfo.playing ? '暂停' : '播放'}
						</button>
					</div>
					<div style={{ display: 'flex', }}>
						{
							attentionEyesInfo.selectIndex !== -1
								? <button className="button default" onClick={onDeleteZoomItem} >删除</button>
								: null
						}
						<button className="button default" onClick={onSaveFrame} disabled={!playInfo.status || !playInfo.update}>
							保存设置
						</button>
						{
						downUrl	? <button className="button default" onClick={onDownLoad}>
									保存视频
								</button>
								: null
						}

					</div>
				</div>
				<div className="time-line" ref={timeLineRef} style={{ pointerEvents: !playInfo.status ? 'none' : 'auto' }}>
					<div className="time-line-progress" style={{ left: `${progressInfo.current}%` }}></div>
					<div className="time-line-progress time-line-progress-mark" style={{ left: `${progressInfo.move}%` }}></div>
					<div className="video-frame-line">
						<div className="video-frame-progress" style={{ width: `${progressInfo.current}%` }}></div>
					</div>
					<div className="attention-control" ref={zoomRef}>
						<div className="zoom-mark" ref={zoomMaskRef} style={{ left: `${zoomMaskInfo.current}%`, width: `${zoomMaskInfo.width}%` }}>+</div>
						{
							zoomDatas.length === 0
								? <div className="tip"> click add zoom</div>
								: zoomDatas.map((item, index) => {
									return <div className="zoom-item" data-index={index} style={{ left: `${item.left}%`, width: `${item.width}%` }} key={item.id}>
										<div className="zoom-item-left" data-index={index} ></div>
										<div className="zoom-item-right" data-index={index} ></div>
									</div>
								})
						}
					</div>
				</div>
			</div>
		</div>
	</>
}

export default VideoPlayer