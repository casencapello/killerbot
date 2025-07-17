const { Client, GatewayIntentBits, PermissionsBitField } = require('discord.js');
const cron = require('node-cron');
const fetch = require('node-fetch');
const express = require('express');

const client = new Client({ 
  intents: [
    GatewayIntentBits.Guilds, 
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent
  ] 
});

const token = process.env.DISCORD_TOKEN;
const WELCOME_CHANNEL_ID = process.env.WELCOME_CHANNEL_ID;
const LOG_CHANNEL_ID = '1395185872126738622';
const UNRECRUITED_ROLE = 'UNRECRUITED';
const SETTER_ROLE_ID = '1395170167763501167';
const REPLIT_URL = process.env.REPLIT_URL || 'https://2c173668-379d-4ce9-8eff-6bec421363ec-00-o5g38mg2m41i.spock.replit.dev/';
const PORT = process.env.PORT || 3001;
const STICKY_CHANNEL_ID = '1395185872126738622';
const STICKY_MESSAGE_CONTENT = '📌 SETTERS, PLEASE REACT WITH 👍 TO THE MESSAGES OF LEADS YOU RECRUITED. THIS IS NOT OPTIONAL.';

let currentStickyMessage = null;
let lastStickyMessageId = null;

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
  "Find a sales accountability partner and check in today."
];

client.once('ready', async () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);

  // On ready, fetch the sticky channel's messages to try to find existing sticky message
  try {
    const channel = await client.channels.fetch(STICKY_CHANNEL_ID);
    if (channel && channel.isTextBased()) {
      const messages = await channel.messages.fetch({ limit: 20 });
      const stickyMsg = messages.find(msg => msg.content === STICKY_MESSAGE_CONTENT);
      if (stickyMsg) {
        currentStickyMessage = stickyMsg;
        lastStickyMessageId = stickyMsg.id;
      } else {
        // No sticky found, post one fresh
        await postSticky(channel);
      }
    }
  } catch (err) {
    console.error('Error fetching sticky message on ready:', err);
  }
});

// Function to post a new sticky message
async function postSticky(channel) {
  if (!channel || !channel.isTextBased()) return;

  // Delete the old sticky message if it exists
  if (currentStickyMessage) {
    try {
      await currentStickyMessage.delete();
      lastStickyMessageId = null;  // Reset ID because we deleted old sticky
      currentStickyMessage = null;
    } catch (err) {
      console.error('Failed to delete old sticky message:', err.message);
    }
  }

  // Send a new sticky message
  try {
    currentStickyMessage = await channel.send(STICKY_MESSAGE_CONTENT);
    lastStickyMessageId = currentStickyMessage.id;
  } catch (err) {
    console.error('Failed to send sticky message:', err.message);
  }
}

// Watch for new messages in the sticky channel
client.on('messageCreate', async message => {
  if (message.channel.id !== STICKY_CHANNEL_ID) return;

  // If the message is the sticky content and not the currently tracked sticky message, update tracking
  if (message.content === STICKY_MESSAGE_CONTENT) {
    if (message.id !== lastStickyMessageId) {
      lastStickyMessageId = message.id;
      currentStickyMessage = message;
      return; // Don't repost sticky message if already present
    }
  }

  // Ignore the current sticky message itself
  if (message.id === lastStickyMessageId) return;

  // For any other message, repost sticky
  await postSticky(message.channel);
});


client.on('guildMemberAdd', async member => {
  const welcomeChannel = member.guild.channels.cache.get(WELCOME_CHANNEL_ID);
  if (welcomeChannel?.isTextBased()) {
    const welcomeMessage = await welcomeChannel.send(`👋 Welcome <@${member.id}>!`);
    setTimeout(() => welcomeMessage.delete().catch(() => {}), 10000);
  }

  setTimeout(() => {
    const role = member.guild.roles.cache.find(r => r.name === UNRECRUITED_ROLE);
    if (role && member.roles.cache.has(role.id)) {
      const logChannel = member.guild.channels.cache.get(LOG_CHANNEL_ID);
      if (logChannel?.isTextBased()) {
        logChannel.send(`✅ <@${member.id}> is unrecruited, any setter can recruit them. <@&${SETTER_ROLE_ID}>`);
      }
    }
  }, 15000);
});

client.on('guildMemberUpdate', async (oldMember, newMember) => {
  const role = newMember.guild.roles.cache.find(r => r.name === UNRECRUITED_ROLE);
  if (!role) return;

  const hadRoleBefore = oldMember.roles.cache.has(role.id);
  const hasRoleNow = newMember.roles.cache.has(role.id);

  if (hadRoleBefore === hasRoleNow) return;

  const logChannel = newMember.guild.channels.cache.get(LOG_CHANNEL_ID);
  if (logChannel?.isTextBased() && !hadRoleBefore && hasRoleNow) {
    logChannel.send(`✅ <@${newMember.id}> is unrecruited, any setter can recruit them. <@&${SETTER_ROLE_ID}>`);
  }
});

client.on('interactionCreate', async interaction => {
  if (!interaction.isChatInputCommand()) return;

  switch (interaction.commandName) {
    case 'dailygoal': {
      const goal = dailyGoals[Math.floor(Math.random() * dailyGoals.length)];
      await interaction.reply(`🎯 **Your daily goal:** ${goal}`);
      break;
    }
    case 'schedule': {
      const date = interaction.options.getString('date');
      const time = interaction.options.getString('time');
      const description = interaction.options.getString('event');
      const ping = interaction.options.getBoolean('ping') ?? false;
      const eventDateTime = new Date(`${date}T${time}:00-06:00`);

      if (isNaN(eventDateTime)) return interaction.reply("⚠️ Invalid date or time.");
      if (eventDateTime <= new Date()) return interaction.reply("🚫 That time is in the past.");

      scheduledEvents.push({ description, eventDateTime, ping, channelId: interaction.channelId, reminded6h: false, reminded1h: false, reminded10m: false });
      await interaction.reply(`✅ Event **${description}** scheduled for ${eventDateTime.toLocaleString('en-US', { timeZone: 'America/Chicago' })} Central Time${ping ? ' with @everyone ping' : ''}.`);
      break;
    }
    case 'mockstart': {
      const user1 = interaction.options.getUser('user1');
      const user2 = interaction.options.getUser('user2');
      if (!user1 || !user2) return interaction.reply({ content: "⚠️ Specify two users.", flags: 1 << 6 });

      const channel = await interaction.guild.channels.create({
        name: `mock-${user1.username}-${user2.username}`,
        type: 0,
        permissionOverwrites: [
          { id: interaction.guild.roles.everyone, deny: [PermissionsBitField.Flags.ViewChannel] },
          { id: user1.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: user2.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
          { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
        ]
      });

      await channel.send(`${user1} and ${user2}, your mock conversation has started!`);
      await interaction.reply({ content: `✅ Created private mock session <#${channel.id}>.`, flags: 1 << 6 });
      inactiveTimers.set(channel.id, Date.now());
      break;
    }
  }
});

cron.schedule('* * * * *', () => {
  const now = new Date();
  scheduledEvents.forEach((event, index) => {
    const channel = client.channels.cache.get(event.channelId);
    if (!channel) return;
    const timeUntil = event.eventDateTime - now;

    const reminders = [
      { threshold: 6 * 60 * 60 * 1000, flag: 'reminded6h', text: '6 hours' },
      { threshold: 1 * 60 * 60 * 1000, flag: 'reminded1h', text: '1 hour' },
      { threshold: 10 * 60 * 1000, flag: 'reminded10m', text: '10 minutes' }
    ];

    reminders.forEach(reminder => {
      if (timeUntil <= reminder.threshold && !event[reminder.flag] && timeUntil > reminder.threshold - 60000) {
        channel.send(`${event.ping ? '@everyone' : ''} ⏰ **Reminder**: ${event.description} starts in ${reminder.text}!`);
        event[reminder.flag] = true;
      }
    });

    if (Math.abs(timeUntil) < 60000) {
      channel.send(`${event.ping ? '@everyone' : ''} 📣 **Event Reminder**: ${event.description} is happening now!`);
      scheduledEvents.splice(index, 1);
    }
  });
});

setInterval(() => {
  const now = Date.now();
  for (const [channelId, lastActive] of inactiveTimers.entries()) {
    if (now - lastActive > 30 * 60 * 1000) {
      const channel = client.channels.cache.get(channelId);
      channel?.delete().then(() => console.log(`Deleted inactive mock session ${channel.name}`)).catch(console.error);
      inactiveTimers.delete(channelId);
    }
  }
}, 5 * 60 * 1000);

client.on('messageCreate', message => {
  if (inactiveTimers.has(message.channel.id)) {
    inactiveTimers.set(message.channel.id, Date.now());
  }
});

const app = express();
app.get('/', (req, res) => res.send('Bot is alive!'));
app.listen(PORT, () => console.log(`Keep-alive server running on port ${PORT}`));

setInterval(async () => {
  try {
    await fetch(REPLIT_URL);
    console.log('Pinged self to stay awake');
  } catch (err) {
    console.error('Failed to ping self:', err);
  }
}, 5 * 60 * 1000);

client.login(token);
