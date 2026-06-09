import fs from 'fs/promises'
import path from 'path'

const sample = {
  generatedAt: new Date().toISOString(),
  status: 'not_measured',
  notes:
    'Realtime latency requires live WebRTC session metrics. Populate by ingesting metrics payloads from realtime sessions.',
  oldSystem: {
    timeToFirstAudioMs: null,
    totalResponseTimeMs: null,
    playbackDelayMs: null,
    interruptionHandlingMs: null,
    perceivedLatencyScore: null,
  },
  webrtcSystem: {
    timeToFirstAudioMs: null,
    totalResponseTimeMs: null,
    playbackDelayMs: null,
    interruptionHandlingMs: null,
    perceivedLatencyScore: null,
  },
  improvements: {
    timeToFirstAudioPercent: null,
    totalResponsePercent: null,
    playbackDelayPercent: null,
    interruptionHandlingPercent: null,
  },
}

const reportDir = path.resolve(process.cwd(), 'reports')
await fs.mkdir(reportDir, { recursive: true })
await fs.writeFile(
  path.join(reportDir, 'realtime-latency-report.json'),
  JSON.stringify(sample, null, 2),
  'utf8',
)

console.log('Realtime latency report generated.')
