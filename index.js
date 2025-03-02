import { IntentsBitField, Client, EmbedBuilder } from "discord.js";
import "dotenv/config";
import data from "./courses.json" assert { type: "json" };

const coursesKeyMap = {
  "Computing &Quantitative Reason": "Computer and Quantitative Reasoning",
  "Intro to JAVA Programming": "introduce TO PROGRAMMING USING JAVA",
};


console.log(data);
const client = new Client({
  intents: [
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.Guilds,
  ],
});

client.on("ready", () => {
  console.log("Bot is ready");
});

client.on("messageCreate", (message) => {
  console.log("Message received: ", message.content);
  const args = message.content.slice("!".length).trim().split(/ +/g);
  const command = args.shift().toLowerCase();
  console.log("Command: ", command);
  console.log("Arguments: ", args);
  if (command === "ping") {
    message.reply("Pong!").then((msg) => {
      msg.edit(`Pong! ${msg.createdTimestamp - message.createdTimestamp}ms`);
    });
  }
  if (command === "courses") {
    const course = args[0];
    if (!course) {
      message.reply("Please provide a course number or --all");
      return;
    }
    if (course === "--all") {
      const embed = new EmbedBuilder()
        .setTitle("All Courses")
        .setDescription(
          data.map((c) => `${c.class_number} - ${c.course_topic}`).join("\n")
        )
        .setColor("#0099ff");
      message.reply({ embeds: [embed] });
      return;
    } else {
      console.log("Course: ", data);
      const courseData = data.filter(
        (c) =>
          c.class_number === course ||
          c.course_topic === coursesKeyMap[course] ||
          c.days_times.some((dt) => dt.day === course)
      )
      // const courseData = data.filter(
      //   (c) =>
      //     c["class_number"] === course ||
      //     c.days_times.some((dt) => dt.day === course)
      // );
      if (!courseData) {
        message.reply("Course not found");
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle("Course Information")
        .setDescription(
          courseData.length > 0 ? courseData.map((c) => {
            return `**${c.class_number}** - ${c.course_topic}\n${c.days_times
              .map(
                (dt) =>
                  `**${dt.day}** - ${dt.startTime} - ${dt.endTime} - ${c.room}`
              )
              .join("\n")}\nProfessor: ${c.instructor.join(", ")}\n`;
          })
          .join("\n\n")
          : "No course found"
          
        ) 
        .setColor("Random");
      message.reply({ embeds: [embed] });
    }
  }
});

client.login(process.env.TOKEN);
