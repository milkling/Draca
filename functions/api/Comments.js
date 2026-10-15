var KeyPattern = /^Book[0-9]{1,3}Chapter[0-9]{1,3}$/;
var NamePattern = /^[A-Za-z0-9]{3,20}$/;
var Reserved = ["anonymous", "admin", "author", "moderator", "inachane", "draca"];
var MaxComments = 500;
var MaxLength = 1000;

function Reply(Body, Status) {
  return new Response(JSON.stringify(Body), {
    status: Status || 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

async function Hash(Text) {
  var Bytes = new TextEncoder().encode(Text);
  var Digest = await crypto.subtle.digest("SHA-256", Bytes);
  return Array.from(new Uint8Array(Digest)).map(function (Byte) {
    return Byte.toString(16).padStart(2, "0");
  }).join("");
}

function MakeToken() {
  var Bytes = new Uint8Array(12);
  crypto.getRandomValues(Bytes);
  var Alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  var Out = "";
  for (var I = 0; I < Bytes.length; I++) Out += Alphabet[Bytes[I] % Alphabet.length];
  return Out.slice(0, 4) + "-" + Out.slice(4, 8) + "-" + Out.slice(8, 12);
}

function NormalizeToken(Token) {
  return String(Token || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

async function ReadList(Store, Key) {
  var Raw = await Store.get("c" + Key);
  if (!Raw) return [];
  try { return JSON.parse(Raw); } catch (Failure) { return []; }
}

async function ReadUser(Store, Name) {
  var Raw = await Store.get("u" + Name.toLowerCase());
  if (!Raw) return null;
  try { return JSON.parse(Raw); } catch (Failure) { return null; }
}

async function Verify(Store, Name, Token) {
  if (!NamePattern.test(Name || "")) return null;
  var User = await ReadUser(Store, Name);
  if (!User) return null;
  var Given = await Hash(NormalizeToken(Token));
  return Given === User.hash ? User : null;
}

function Publish(Item) {
  return { id: Item.id, name: Item.name, text: Item.text, time: Item.time, member: !!Item.member };
}

async function Cooldown(Context, Store, Seconds) {
  var Address = Context.request.headers.get("CF-Connecting-IP") || "unknown";
  var Mark = "r" + (await Hash(Address)).slice(0, 24);
  var Last = parseInt(await Store.get(Mark), 10) || 0;
  if (Date.now() - Last < Seconds * 1000) return false;
  await Store.put(Mark, String(Date.now()), { expirationTtl: 60 });
  return true;
}

export async function onRequestGet(Context) {
  var Store = Context.env.STATS;
  if (!Store) return Reply({ error: "NoStore" }, 500);
  var Url = new URL(Context.request.url);
  var Keys = Url.searchParams.get("keys");
  if (Keys !== null) {
    var Wanted = Keys.split(",").filter(function (Item) { return KeyPattern.test(Item); }).slice(0, 60);
    var Counts = {};
    for (var Each of Wanted) Counts[Each] = (await ReadList(Store, Each)).length;
    return Reply({ counts: Counts });
  }
  var Key = Url.searchParams.get("key") || "";
  if (!KeyPattern.test(Key)) return Reply({ error: "BadKey" }, 400);
  var List = await ReadList(Store, Key);
  return Reply({ comments: List.map(Publish) });
}

export async function onRequestPost(Context) {
  var Store = Context.env.STATS;
  if (!Store) return Reply({ error: "NoStore" }, 500);
  var Body = null;
  try { Body = await Context.request.json(); } catch (Failure) { return Reply({ error: "BadBody" }, 400); }
  if (!Body) return Reply({ error: "BadBody" }, 400);
  var Action = Body.action;

  if (Action === "register") {
    var Wanted = String(Body.name || "").trim();
    if (!NamePattern.test(Wanted)) return Reply({ error: "BadName" }, 400);
    if (Reserved.indexOf(Wanted.toLowerCase()) >= 0) return Reply({ error: "Taken" }, 409);
    if (await ReadUser(Store, Wanted)) return Reply({ error: "Taken" }, 409);
    if (!(await Cooldown(Context, Store, 20))) return Reply({ error: "Slow" }, 429);
    var Token = MakeToken();
    var Record = { name: Wanted, hash: await Hash(NormalizeToken(Token)), made: Date.now() };
    await Store.put("u" + Wanted.toLowerCase(), JSON.stringify(Record));
    return Reply({ name: Wanted, token: Token });
  }

  if (Action === "login") {
    var Found = await Verify(Store, String(Body.name || "").trim(), Body.token);
    if (!Found) return Reply({ error: "BadLogin" }, 401);
    return Reply({ name: Found.name, token: String(Body.token).trim().toUpperCase() });
  }

  var Key = Body.key;
  if (!KeyPattern.test(Key || "")) return Reply({ error: "BadKey" }, 400);

  if (Action === "post") {
    var Text = String(Body.text || "").replace(/\r/g, "").trim();
    if (!Text) return Reply({ error: "Empty" }, 400);
    if (Text.length > MaxLength) return Reply({ error: "TooLong" }, 400);
    var Name = "Anonymous";
    var Member = false;
    if (Body.name) {
      var Owner = await Verify(Store, String(Body.name).trim(), Body.token);
      if (!Owner) return Reply({ error: "BadLogin" }, 401);
      Name = Owner.name;
      Member = true;
    }
    if (!(await Cooldown(Context, Store, 8))) return Reply({ error: "Slow" }, 429);
    var List = await ReadList(Store, Key);
    var Item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: Name,
      text: Text,
      time: Date.now(),
      member: Member
    };
    if (Member) Item.owner = await Hash(Name.toLowerCase());
    List.push(Item);
    if (List.length > MaxComments) List = List.slice(List.length - MaxComments);
    await Store.put("c" + Key, JSON.stringify(List));
    return Reply({ comment: Publish(Item) });
  }

  if (Action === "delete") {
    var Current = await ReadList(Store, Key);
    var Target = Current.filter(function (Entry) { return Entry.id === Body.id; })[0];
    if (!Target) return Reply({ error: "Missing" }, 404);
    var IsAdmin = !!Context.env.AdminKey && Body.admin === Context.env.AdminKey;
    var IsOwner = false;
    if (Target.owner && Body.name) {
      var Check = await Verify(Store, String(Body.name).trim(), Body.token);
      IsOwner = !!Check && (await Hash(Check.name.toLowerCase())) === Target.owner;
    }
    if (!IsAdmin && !IsOwner) return Reply({ error: "Forbidden" }, 403);
    var Kept = Current.filter(function (Entry) { return Entry.id !== Body.id; });
    await Store.put("c" + Key, JSON.stringify(Kept));
    return Reply({ ok: true });
  }

  return Reply({ error: "BadAction" }, 400);
}
