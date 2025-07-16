const { REST, Routes, SlashCommandBuilder } = require('discord.js');

const token = process.env.DISCORD_TOKEN;  // Replit secret or .env
const clientId = process.env.CLIENT_ID;   // replace with your bot client ID
const guildId = process.env.GUILD_ID;    // replace with your guild ID

const commands = [
  new SlashCommandBuilder()
    .setName('dailygoal')
    .setDescription('Get a random daily goal'),

  new SlashCommandBuilder()
    .setName('schedule')
    .setDescription('Create a scheduled event (time in Central Time)')
    .addStringOption(option =>
      option.setName('date')
        .setDescription('Date in YYYY-MM-DD')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('time')
        .setDescription('Time in 24h HH:mm (Central Time)')
        .setRequired(true))
    .addStringOption(option =>
      option.setName('event')
        .setDescription('Event description')
        .setRequired(true))
    .addBooleanOption(option =>
      option.setName('ping')
        .setDescription('Should @everyone be pinged when it starts?')),

  new SlashCommandBuilder()
    .setName('mockstart')
    .setDescription('Start a private mock conversation between two users')
    .addUserOption(option =>
      option.setName('user1')
        .setDescription('First user to include')
        .setRequired(true))
    .addUserOption(option =>
      option.setName('user2')
        .setDescription('Second user to include')
        .setRequired(true)),
].map(command => command.toJSON());

const rest = new REST({ version: '10' }).setToken(token);

(async () => {
  try {
    console.log('Refreshing slash commands...');
    await rest.put(
      Routes.applicationGuildCommands(clientId, guildId),
      { body: commands }
    );
    console.log('✅ Successfully deployed application commands.');
  } catch (error) {
    console.error(error);
  }
})();
