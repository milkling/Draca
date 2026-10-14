var KeyPattern = /^[A-Za-z0-9]{1,40}$/;

function Reply(Body, Status) {
  return new Response(JSON.stringify(Body), {
    status: Status || 200,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

async function ReadStats(Store, Key) {
  var Views = parseInt(await Store.get("v" + Key), 10) || 0;
  var Likes = parseInt(await Store.get("l" + Key), 10) || 0;
  return { v: Views, l: Likes };
}

export async function onRequestGet(Context) {
  var Store = Context.env.STATS;
  if (!Store) return Reply({ error: "NoStore" }, 500);
  var Url = new URL(Context.request.url);
  var Keys = (Url.searchParams.get("keys") || "").split(",").filter(function (Key) {
    return KeyPattern.test(Key);
  }).slice(0, 60);
  var Result = {};
  for (var Key of Keys) Result[Key] = await ReadStats(Store, Key);
  return Reply(Result);
}

export async function onRequestPost(Context) {
  var Store = Context.env.STATS;
  if (!Store) return Reply({ error: "NoStore" }, 500);
  var Body = null;
  try { Body = await Context.request.json(); } catch (Failure) { return Reply({ error: "BadBody" }, 400); }
  var Key = Body && Body.key;
  var Action = Body && Body.action;
  if (!KeyPattern.test(Key || "")) return Reply({ error: "BadKey" }, 400);
  var Current = await ReadStats(Store, Key);
  if (Action === "view") {
    Current.v += 1;
    await Store.put("v" + Key, String(Current.v));
  } else if (Action === "like") {
    Current.l += 1;
    await Store.put("l" + Key, String(Current.l));
  } else if (Action === "unlike") {
    Current.l = Math.max(0, Current.l - 1);
    await Store.put("l" + Key, String(Current.l));
  } else {
    return Reply({ error: "BadAction" }, 400);
  }
  return Reply(Current);
}
