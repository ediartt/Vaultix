import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} from "discord.js";
import fs from "fs";

// ================= CONFIG =================
const TOKEN = "MTQ2MDY2NDc0NzM0NjM2MjQyOA.GDzVou.1p9oFYPSxMb8EHdHJPIMerxn3E7C2nQspHcDS8";
const CLIENT_ID = "YOUR_CLIENT_ID_HERE";
const DATA_FILE = "./economy.json";

const UNLIMITED_USERS = [
  "888725327398969346", // Developer
  "1265134561273188407" // Developer's gf
];

// ================= CLIENT =================
const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

// ================= DATABASE =================
let db = {};
if (fs.existsSync(DATA_FILE)) {
  db = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function saveDB() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2));
}

function getUser(id) {
  if (!db[id]) {
    db[id] = {
      wallet: 0,
      vault: 0,
      lastWork: 0
    };
  }
  return db[id];
}

function isUnlimited(id) {
  return UNLIMITED_USERS.includes(id);
}

function addMoney(id, amount) {
  if (isUnlimited(id)) return;
  const user = getUser(id);
  user.wallet += amount;
  saveDB();
}

function removeMoney(id, amount) {
  if (isUnlimited(id)) return true;
  const user = getUser(id);
  if (user.wallet < amount) return false;
  user.wallet -= amount;
  saveDB();
  return true;
}

// ================= SLASH COMMANDS =================
const commands = [
  new SlashCommandBuilder()
    .setName("balance")
    .setDescription("View your euro balance"),

  new SlashCommandBuilder()
    .setName("work")
    .setDescription("Work to earn euros"),

  new SlashCommandBuilder()
    .setName("deposit")
    .setDescription("Deposit euros into your vault")
    .addIntegerOption(opt =>
      opt.setName("amount")
        .setDescription("Amount to deposit")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("withdraw")
    .setDescription("Withdraw euros from your vault")
    .addIntegerOption(opt =>
      opt.setName("amount")
        .setDescription("Amount to withdraw")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("View the richest users")
].map(cmd => cmd.toJSON());

// ================= REGISTER COMMANDS =================
const rest = new REST({ version: "10" }).setToken(TOKEN);

(async () => {
  try {
    console.log("⏳ Registering slash commands...");
    await rest.put(
      Routes.applicationCommands(CLIENT_ID),
      { body: commands }
    );
    console.log("✅ Slash commands registered");
  } catch (error) {
    console.error(error);
  }
})();

// ================= BOT READY =================
client.once("ready", () => {
  console.log(`✅ Logged in as ${client.user.tag}`);
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const userId = interaction.user.id;
  const user = getUser(userId);

  // ===== BALANCE =====
  if (interaction.commandName === "balance") {
    const wallet = isUnlimited(userId) ? "∞" : `€${user.wallet}`;
    const vault = isUnlimited(userId) ? "∞" : `€${user.vault}`;

    const embed = new EmbedBuilder()
      .setTitle("💶 Your Balance")
      .addFields(
        { name: "Wallet", value: wallet, inline: true },
        { name: "Vault", value: vault, inline: true }
      )
      .setColor(0x00b894);

    return interaction.reply({ embeds: [embed] });
  }

  // ===== WORK =====
  if (interaction.commandName === "work") {
    const now = Date.now();
    const cooldown = 6 * 60 * 60 * 1000;

    if (!isUnlimited(userId) && now - user.lastWork < cooldown) {
      const minutes = Math.ceil(
        (cooldown - (now - user.lastWork)) / 60000
      );
      return interaction.reply({
        content: `⏳ You can work again in **${minutes} minutes**.`,
        ephemeral: true
      });
    }

    const earned = Math.floor(300 + Math.random() * 300);
    user.lastWork = now;
    addMoney(userId, earned);

    return interaction.reply(`💼 You worked and earned **€${earned}**`);
  }

  // ===== DEPOSIT =====
  if (interaction.commandName === "deposit") {
    const amount = interaction.options.getInteger("amount");

    if (amount <= 0)
      return interaction.reply({ content: "❌ Invalid amount.", ephemeral: true });

    if (!removeMoney(userId, amount))
      return interaction.reply({ content: "❌ Not enough euros.", ephemeral: true });

    user.vault += amount;
    saveDB();

    return interaction.reply(`🏦 Deposited **€${amount}** into your vault.`);
  }

  // ===== WITHDRAW =====
  if (interaction.commandName === "withdraw") {
    const amount = interaction.options.getInteger("amount");

    if (amount <= 0)
      return interaction.reply({ content: "❌ Invalid amount.", ephemeral: true });

    if (user.vault < amount)
      return interaction.reply({ content: "❌ Not enough euros in vault.", ephemeral: true });

    user.vault -= amount;
    addMoney(userId, amount);

    return interaction.reply(`🏦 Withdrew **€${amount}** from your vault.`);
  }

  // ===== LEADERBOARD =====
  if (interaction.commandName === "leaderboard") {
    const sorted = Object.entries(db)
      .map(([id, data]) => ({
        id,
        total: data.wallet + data.vault
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    const desc = sorted.map((u, i) => {
      const amount = UNLIMITED_USERS.includes(u.id) ? "∞" : `€${u.total}`;
      return `**${i + 1}.** <@${u.id}> — ${amount}`;
    }).join("\n");

    const embed = new EmbedBuilder()
      .setTitle("🏆 Richest Users")
      .setDescription(desc || "No data yet.")
      .setColor(0xf1c40f);

    return interaction.reply({ embeds: [embed] });
  }
});

// ================= LOGIN =================
client.login(TOKEN);
