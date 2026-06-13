import {
  CLIENT_TYPE_OPTIONS,
  resolveClientWelcomeMessage,
} from "../lib/client-profile";

const TEST_WELCOME =
  "שלום ועד הבית,\nברוכים הבאים לפורטל הלקוח של פורטה בקרה.\nלהלן נתוני הבניין המעודכנים.";

console.log("=== אימות לוגי: client_type + welcome_message ===\n");

const clientType = "ועד בית";
assert(
  (CLIENT_TYPE_OPTIONS as readonly string[]).includes(clientType),
  "client_type בתוך CLIENT_TYPE_OPTIONS"
);

const createPayload = {
  client_type: clientType,
  welcome_message: TEST_WELCOME.trim(),
};

assert(createPayload.client_type === "ועד בית", "שמירה: client_type");
assert(
  createPayload.welcome_message === TEST_WELCOME,
  "שמירה: welcome_message מלא"
);

const mappedRow = {
  client_type: String(createPayload.client_type),
  welcome_message: String(createPayload.welcome_message),
};

const readClientType = mappedRow.client_type;
const readWelcome = resolveClientWelcomeMessage(mappedRow.welcome_message);

assert(readClientType === "ועד בית", "קריאה: client_type");
assert(readWelcome === TEST_WELCOME, "קריאה: welcome_message בפורטל");

const nullWelcome = resolveClientWelcomeMessage(null);
assert(
  nullWelcome.includes("ברוכים הבאים לפורטל הלקוח"),
  "תאימות לאחור: welcome_message ריק"
);

console.log("client_type:", readClientType);
console.log("welcome_message בפורטל:");
console.log(readWelcome);
console.log("\nתוצאה: PASS — שמירה וקריאה תקינות (לוגיקה)");

function assert(condition: boolean, label: string) {
  if (!condition) {
    console.error("FAIL:", label);
    process.exit(1);
  }
  console.log("✓", label);
}
