import { IntentsBitField, Client } from "discord.js"
import "dotenv/config"

const client = new Client({ intents: [IntentsBitField.Flags.MessageContent] });

client.on("ready", () => {
    console.log("Bot is ready")
})

client.login(process.env.TOKEN);
