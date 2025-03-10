import { IntentsBitField, Client, EmbedBuilder } from "discord.js";
import "dotenv/config";
import data from "./courses.json" assert { type: "json" };
import ollama from "ollama";

console.log(data);
const client = new Client({
  intents: [
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.Guilds,
  ],
});

client.on("ready", async (c) => {
  console.log("Bot is ready");

  await c.application.commands.create({
    name: "courses",
    description: "Get course information",
    options: [
      {
        name: "course",
        description: "Course number",
        type: 3,
        required: true,
        autocomplete: true,
      },
    ],
  });

  await c.application.commands.create({
    name: "chat",
    description: "Chat with the bot",
    options: [
      {
        name: "message",
        description: "Message to send",
        type: 3,
        required: true,
      },
    ],
  });

  console.log(await c.application.commands.fetch());
});

client.on("interactionCreate", async (interaction) => {
  if (interaction.isAutocomplete()) {
    if (interaction.commandName === "courses") {
      const course = interaction.options.getString("course");
      const courseData = data
        .filter(
          (c) =>
            c.class_number.toLowerCase().includes(course) ||
            c.course_topic.toLowerCase().includes(course) ||
            c.days_times.some((dt) => dt.day.toLowerCase().includes(course))
        )
        .slice(0, 24);

      const choices =
        courseData.length > 0
          ? courseData.map((c) => {
              return {
                name: `${c.class_number} - ${c.course_topic}`,
                value: c.class_number,
              };
            })
          : data.slice(0, 24).map((c) => ({
              name: `${c.class_number} - ${c.course_topic}`,
              value: c.class_number,
            }));
      console.log("Choices: ", choices);
      if (!interaction.responded) return await interaction.respond(choices);
    }
  }

  if (!interaction.isCommand()) return;
  const args = createArguement(interaction.options.data);

  if (interaction.commandName === "chat") {
    const message = args.message;
    if (!message) {
      return interaction.reply("Please provide a message");
    }

    const conversationLogs = [
      {
        role: "system",
        content: `
        You are a Brooklyn College room availability assistant for Ingrosoll only. Your purpose is to help students find available study spaces on campus.
        Using the provided course schedule data: ${JSON.stringify(data)}, you should:
        1. Analyze room schedules and identify gaps between classes
        2. For each available room, provide:
          - Room number and building location
          - Available time slots
          - Previous class end time and next class start time
          - Current date and day of week
        3. Sort results by:
          - Current/upcoming availability first
          - Duration of availability (longer slots first)
          - Building proximity to student centers
        Format responses clearly with:
          - Time slots in 12-hour format (e.g., 9:30 AM - 11:00 AM)
          - Building and room numbers in bold
          - Clear separation between different available rooms
          - Brief notes about room features when available

        Keep responses concise and focused on immediate availability.`,
      },
      {
        role: "user",
        content: message,
      },
    ];
    const res = await interaction.deferReply();
    const response = await ollama.chat({
      model: "qwen2.5:latest",
      messages: conversationLogs,
      stream: true,
    });
    const responseMessage = [];
    // for await (const message of response) {
    //   responseMessage.push(message.message);
    // }
    // console.log("Response: ", responseMessage);
    // await res.edit(responseMessage[
    //   responseMessage.length - 1
    // ]);
    let currentChunk = "";
    const CHUNK_SIZE = 1900; // Discord's limit is 2000, leaving some room for formatting
    function removeThinkTags(text) {
      const regex = /<think>[\s\S]*?<\/think>/g;
      return text.replace(regex, "");
    }

    for await (const message of response) {
      currentChunk += message.message.content;

      // When chunk reaches near limit, push to array and reset
      if (currentChunk.length >= CHUNK_SIZE) {
        currentChunk = removeThinkTags(currentChunk);
        responseMessage.push(currentChunk);
        currentChunk = "";
      }
    }
    // Push any remaining content
    currentChunk = removeThinkTags(currentChunk);
    if (currentChunk.length > 0) {
      responseMessage.push(currentChunk);
    }
    // Send chunks as separate messages
    for (const chunk of responseMessage) {
      const previous = await interaction.fetchReply();
      // Append new chunk to previous message content
      const updatedContent = previous.content
        ? `${previous.content}\n${chunk}`
        : chunk;
      await res.edit(updatedContent);
      if (responseMessage.length > 1) {
        await interaction.followUp({
          content
        })
        await new Promise((resolve) => setTimeout(resolve, 1000)); // 1s delay between chunks
      }
    }
  }

  if (interaction.commandName === "courses") {
    const course = args.course;
    if (!course) {
      return interaction.reply("Please provide a course number");
    }
    console.log("Course: ", data);
    const courseData = data.filter(
      (c) =>
        c.class_number.toLowerCase() === course.toLowerCase() ||
        c.days_times.some((dt) => dt.day.toLowerCase() === course.toLowerCase())
    );

    if (!courseData) {
      return interaction.reply("Course not found");
    }
    const embed = new EmbedBuilder()
      .setTitle("Course Information")
      .setDescription(
        courseData.length > 0
          ? courseData
              .map((c) => {
                return `**${c.class_number}** - ${
                  c.course_topic
                }\n${c.days_times
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
    return interaction.reply({ embeds: [embed] });
  }
});

function createArguement(options) {
  return Object.assign(
    {},
    ...options.map((o) => {
      if (o.options) return createArguement(o.options);
      return { [o.name]: o.value };
    })
  );
}