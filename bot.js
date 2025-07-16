const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const cron = require('node-cron');
const fetch = require('node-fetch');
const express = require('express');
// Discord client setup
const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ] 
});

const token = process.env.DISCORD_TOKEN; // use Replit secret

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const roleNameToWatch = 'UNRECRUITED';
  const logChannelId = '1395185872126738622';

  const role = newMember.guild.roles.cache.find(r => r.name === roleNameToWatch);
  if (!role) return;

  const hadRoleBefore = oldMember.roles.cache.has(role.id);
  const hasRoleNow = newMember.roles.cache.has(role.id);

  if (hadRoleBefore === hasRoleNow) return;

  const logChannel = newMember.guild.channels.cache.get(logChannelId);
  if (!logChannel || !logChannel.isTextBased()) return;

  if (!hadRoleBefore && hasRoleNow) {
    logChannel.send(
      `✅ ${`<@${newMember.id}>`} is unrecruited, any setter can recruit them. <@&1395170167763501167>`
    );
  }
}); // <-- This was missing!



// Setup Express keep-alive server
const app = express();
const PORT = process.env.PORT || 3000;
const REPLIT_URL = process.env.REPLIT_URL || 'https://2c173668-379d-4ce9-8eff-6bec421363ec-00-o5g38mg2m41i.spock.replit.dev/';

app.get('/', (req, res) => {
  res.send('Bot is alive!');
});

app.listen(PORT, () => {
  console.log(`Keep-alive server running on port ${PORT}`);
});

setInterval(async () => {
  try {
    await fetch(REPLIT_URL);
    console.log('Pinged self to stay awake');
  } catch (err) {
    console.error('Failed to ping self:', err);
  }
}, 5 * 60 * 1000); // 30 minutes ping



const scheduledEvents = [];
const inactiveTimers = new Map();

const dailyGoals = [
  "Make 20 follow-up DM’s to previous leads today.",
  "Book at least 3 new qualified appointments.",
  "Send personalized messages to 15 prospects.",
  "Network with another affiliate or setter today.",
  "Follow up with any prospect that went cold in the last 14 days.",
  "Listen to a podcast about overcoming sales objections.",
  "Ask a past client for a referral.",
  "Watch a motivational video to fire up your mindset.",
  "Find a sales accountability partner and check in today.",
];

client.once('ready', () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === 'dailygoal') {
    const goal = dailyGoals[Math.floor(Math.random() * dailyGoals.length)];
    await interaction.reply(`🎯 **Your daily goal:** ${goal}`);
  }

  if (interaction.commandName === 'schedule') {
    const date = interaction.options.getString('date');
    const time = interaction.options.getString('time');
    const description = interaction.options.getString('event');
    const ping = interaction.options.getBoolean('ping') ?? false;

    const eventDateTime = new Date(`${date}T${time}:00-06:00`);

    if (isNaN(eventDateTime)) {
      await interaction.reply("⚠️ Invalid date or time. Use YYYY-MM-DD and HH:mm (24hr) format, Central Time.");
      return;
    }

    const now = new Date();
    if (eventDateTime <= now) {
      await interaction.reply("🚫 That time is in the past. Please schedule for the future.");
      return;
    }

    scheduledEvents.push({
      description,
      eventDateTime,
      ping,
      channelId: interaction.channelId,
      reminded6h: false,
      reminded1h: false,
      reminded10m: false,
    });

    await interaction.reply(`✅ Event **${description}** scheduled for ${eventDateTime.toLocaleString('en-US', { timeZone: 'America/Chicago' })} Central Time${ping ? ' with @everyone ping' : ''}.`);
  }

  if (interaction.commandName === 'mockstart') {
    const guild = interaction.guild;
    const user1 = interaction.options.getUser('user1');
    const user2 = interaction.options.getUser('user2');

    if (!user1 || !user2) {
      await interaction.reply({
        content: "⚠️ You must specify two users to start a mock conversation.",
        flags: 1 << 6 // ephemeral flag
      });
      return;
    }

    const channel = await guild.channels.create({
      name: `mock-${user1.username}-${user2.username}`,
      type: 0, // GUILD_TEXT
      permissionOverwrites: [
        {
          id: guild.roles.everyone,
          deny: [PermissionsBitField.Flags.ViewChannel]
        },
        {
          id: user1.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        },
        {
          id: user2.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        },
        {
          id: client.user.id,
          allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages]
        }
      ]
    });

    await channel.send(`${user1} and ${user2}, your mock conversation has started!`);
    await interaction.reply({
      content: `✅ Created private mock session <#${channel.id}> for ${user1} and ${user2}.`,
      flags: 1 << 6 // this is the ephemeral bit flag
    });

    // Set initial last active time
    inactiveTimers.set(channel.id, Date.now());
  }
});

// cron to check scheduled event reminders
cron.schedule('* * * * *', () => {
  const now = new Date();

  scheduledEvents.forEach((event, index) => {
    const channel = client.channels.cache.get(event.channelId);
    if (!channel) return;

    const timeUntil = event.eventDateTime.getTime() - now.getTime();

    if (timeUntil <= 6 * 60 * 60 * 1000 && !event.reminded6h && timeUntil > 5.9 * 60 * 60 * 1000) {
      const mention = event.ping ? '@everyone' : '';
      channel.send(`${mention} ⏰ **Reminder**: ${event.description} starts in 6 hours!`);
      event.reminded6h = true;
    }

    if (timeUntil <= 1 * 60 * 60 * 1000 && !event.reminded1h && timeUntil > 0.9 * 60 * 60 * 1000) {
      const mention = event.ping ? '@everyone' : '';
      channel.send(`${mention} ⏰ **Reminder**: ${event.description} starts in 1 hour!`);
      event.reminded1h = true;
    }

    if (timeUntil <= 10 * 60 * 1000 && !event.reminded10m && timeUntil > 9 * 60 * 1000) {
      const mention = event.ping ? '@everyone' : '';
      channel.send(`${mention} ⏰ **Reminder**: ${event.description} starts in 10 minutes!`);
      event.reminded10m = true;
    }

    if (
      event.eventDateTime.getFullYear() === now.getFullYear() &&
      event.eventDateTime.getMonth() === now.getMonth() &&
      event.eventDateTime.getDate() === now.getDate() &&
      event.eventDateTime.getHours() === now.getHours() &&
      event.eventDateTime.getMinutes() === now.getMinutes()
    ) {
      const mention = event.ping ? '@everyone' : '';
      channel.send(`${mention} 📣 **Event Reminder**: ${event.description} is happening now!`);
      scheduledEvents.splice(index, 1); // remove after announcing
    }
  });
});

// clear inactive mock chats every 5 min
setInterval(async () => {
  const now = Date.now();
  for (const [channelId, lastActive] of inactiveTimers.entries()) {
    if (now - lastActive > 30 * 60 * 1000) { // 30 mins
      const channel = client.channels.cache.get(channelId);
      if (channel) {
        await channel.delete().catch(console.error);
        console.log(`Deleted inactive mock session ${channel.name}`);
      }
      inactiveTimers.delete(channelId);
    }
  }
}, 5 * 60 * 1000);

// Reset inactivity timer on message in mock channel
client.on('messageCreate', message => {
  if (inactiveTimers.has(message.channel.id)) {
    inactiveTimers.set(message.channel.id, Date.now());
  }
});

client.login(token);
