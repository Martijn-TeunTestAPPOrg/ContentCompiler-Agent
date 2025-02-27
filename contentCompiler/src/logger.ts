import winston, { format } from "winston";
const { combine, timestamp, label, printf } = format;

const customFormat = printf(({ level, message, label, timestamp }) => {
    return `${timestamp} [${label}] ${level}: ${message}`;
});

export function createCustomLogger(customLabel: string) {
    const logFilePath = `logs/${customLabel}-${new Date().toISOString()}.log`;

    return winston.createLogger({
        level: "info",
        format: combine(
            label({ label: customLabel }),      // Add a label to the logs
            timestamp(),                        // Add a timestamp to the logs
            customFormat                        // Use the custom format
        ),
        transports: [
            new winston.transports.File({ filename: logFilePath }),
            new winston.transports.Console(),
        ],
    });
}
