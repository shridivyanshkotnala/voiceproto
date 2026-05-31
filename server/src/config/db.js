import mongoose from 'mongoose'

let connection

export async function connectDB() {
	const uri = process.env.MONGODB_URI

	if (!uri) {
		throw new Error('MONGODB_URI is not defined in environment variables.')
	}

	if (connection) {
		return connection
	}

	connection = await mongoose.connect(uri)
	console.log('MongoDB connected')
	return connection
}
