import { IntentsBitField, Client } from "discord.js"
import "dotenv/config"

const client = new Client({ intents: [IntentsBitField.Flags.MessageContent, IntentsBitField.Flags.GuildMessages, IntentsBitField.Flags.Guilds] });

client.on("ready", () => {
    console.log("Bot is ready")
})

client.on("messageCreate", (message) => {
    console.log("Message received: ", message.content)
    if (message.content === "ping") {
        message.reply("pong")
    }
})

client.login(process.env.TOKEN);
