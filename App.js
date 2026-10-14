var App = document.getElementById("App");
var Nav = document.getElementById("Nav");

var All = [];
Books.forEach(function (Book, BookIndex) {
  Book.Chapters.forEach(function (Chapter, ChapterIndex) {
    All.push({
      Book: Book,
      Chapter: Chapter,
      BookIndex: BookIndex,
      ChapterIndex: ChapterIndex,
      Key: "Book" + (BookIndex + 1) + "Chapter" + (ChapterIndex + 1)
    });
  });
});

function FindByHash() {
  var Match = /^#(Book\d+Chapter\d+)$/.exec(location.hash);
  if (!Match) return -1;
  for (var I = 0; I < All.length; I++) {
    if (All[I].Key === Match[1]) return I;
  }
  return -1;
}

function Make(Tag, ClassName, Text) {
  var Node = document.createElement(Tag);
  if (ClassName) Node.className = ClassName;
  if (Text !== undefined) Node.textContent = Text;
  return Node;
}

function Link(Text, Href, Extra) {
  var Anchor = Make("a", "Btn" + (Extra ? " " + Extra : ""), Text);
  Anchor.href = Href;
  return Anchor;
}

function OriginalLink(Url, ClassName) {
  var Target = Url || SiteInfo.OriginalUrl;
  if (!Target) return null;
  var Anchor = Make("a", ClassName, SiteInfo.OriginalText);
  Anchor.href = Target;
  Anchor.target = "_blank";
  Anchor.rel = "noopener";
  return Anchor;
}

function CountsText(Data) {
  var Comments = Data.c || 0;
  var Likes = Data.r || 0;
  return Comments + (Comments === 1 ? " comment" : " comments") + " \u00b7 " + Likes + (Likes === 1 ? " like" : " likes");
}

var CountsPromise = null;

function GetCounts() {
  if (!CountsPromise) {
    CountsPromise = fetch("Counts.json?t=" + Date.now())
      .then(function (Response) { return Response.ok ? Response.json() : null; })
      .catch(function () { return null; });
  }
  return CountsPromise;
}

function LoadCounts(Entry, Target) {
  GetCounts().then(function (Counts) {
    if (!Counts) { Target.textContent = ""; return; }
    Target.textContent = CountsText(Counts[Entry.Key] || {});
  });
}

function RenderHome() {
  document.title = SiteInfo.Title;
  Nav.innerHTML = "";
  App.innerHTML = "";
  var Wrap = Make("div", "Home");

  var Hero = Make("div", "Hero");
  var Cover = Make("img", "Cover");
  Cover.src = SiteInfo.Cover;
  Cover.alt = "";
  Cover.onerror = function () { Cover.remove(); };
  Hero.appendChild(Cover);

  var Text = Make("div", "HeroText");
  Text.appendChild(Make("h1", "", SiteInfo.Title));
  Text.appendChild(Make("p", "", SiteInfo.Tagline));
  var Actions = Make("div", "Actions");
  if (All.length > 0) {
    var Start = Make("a", "Start", "Start reading");
    Start.href = "#" + All[0].Key;
    Actions.appendChild(Start);
  }
  var Original = OriginalLink("", "Original");
  if (Original) Actions.appendChild(Original);
  Text.appendChild(Actions);
  Hero.appendChild(Text);
  Wrap.appendChild(Hero);

  Books.forEach(function (Book, BookIndex) {
    var Section = Make("section", "Book");
    var Head = Make("div", "BookHead");
    Head.appendChild(Make("h2", "", Book.Title));
    var BookLink = Book.OriginalUrl ? OriginalLink(Book.OriginalUrl, "BookLink") : null;
    if (BookLink) Head.appendChild(BookLink);
    Section.appendChild(Head);

    var List = Make("div", "List");
    Book.Chapters.forEach(function (Chapter, ChapterIndex) {
      var Entry = All.filter(function (Item) {
        return Item.BookIndex === BookIndex && Item.ChapterIndex === ChapterIndex;
      })[0];
      var Row = Make("a", "Row");
      Row.href = "#" + Entry.Key;
      Row.appendChild(Make("span", "RowTitle", Chapter.Title));
      if (Chapter.Pages) {
        Row.appendChild(Make("span", "RowMeta", Chapter.Pages + (Chapter.Pages === 1 ? " page" : " pages")));
      }
      List.appendChild(Row);
      var Counts = Make("span", "RowCounts", "");
      Row.appendChild(Counts);
      LoadCounts(Entry, Counts);
    });
    Section.appendChild(List);
    Wrap.appendChild(Section);
  });

  App.appendChild(Wrap);
  window.scrollTo(0, 0);
}

function AddComments(Entry) {
  var Config = SiteInfo.Giscus;
  if (!Config || !Config.Repo || !Config.RepoId || !Config.CategoryId) return;
  var Box = Make("div", "Comments");
  var Tag = document.createElement("script");
  Tag.src = "https://giscus.app/client.js";
  Tag.async = true;
  Tag.crossOrigin = "anonymous";
  Tag.setAttribute("data-repo", Config.Repo);
  Tag.setAttribute("data-repo-id", Config.RepoId);
  Tag.setAttribute("data-category", Config.Category);
  Tag.setAttribute("data-category-id", Config.CategoryId);
  Tag.setAttribute("data-mapping", "specific");
  Tag.setAttribute("data-term", Entry.Key);
  Tag.setAttribute("data-reactions-enabled", "1");
  Tag.setAttribute("data-input-position", "top");
  Tag.setAttribute("data-theme", "preferred_color_scheme");
  Tag.setAttribute("data-lang", "en");
  Box.appendChild(Tag);
  App.appendChild(Box);
}

function LoadPages(Reader, Chapter, PageIndex, ChapterIndex) {
  if (FindByHash() !== ChapterIndex) return;
  if (Chapter.Pages && PageIndex >= Chapter.Pages) return;
  var Candidates = [];
  ["page", "Page"].forEach(function (Prefix) {
    ["png", "jpg", "jpeg", "webp"].forEach(function (Extension) {
      Candidates.push(Chapter.Folder + "/" + Prefix + (PageIndex + 1) + "." + Extension);
    });
  });
  var Tried = 0;
  var Img = document.createElement("img");
  Img.alt = Chapter.Title + " page " + (PageIndex + 1);
  Img.onload = function () {
    Reader.appendChild(Img);
    LoadPages(Reader, Chapter, PageIndex + 1, ChapterIndex);
  };
  Img.onerror = function () {
    Tried++;
    if (Tried < Candidates.length) {
      Img.src = Candidates[Tried];
    } else if (PageIndex === 0) {
      Reader.appendChild(Make("div", "Empty", "No pages here yet."));
    }
  };
  Img.src = Candidates[0];
}

function RenderChapter(Index) {
  var Entry = All[Index];
  var Chapter = Entry.Chapter;
  document.title = Chapter.Title + " | " + SiteInfo.Title;
  Nav.innerHTML = "";
  var HasPrev = Index > 0;
  var HasNext = Index < All.length - 1;
  var PrevHref = HasPrev ? "#" + All[Index - 1].Key : "#" + Entry.Key;
  var NextHref = HasNext ? "#" + All[Index + 1].Key : "#" + Entry.Key;
  Nav.appendChild(Link("Prev", PrevHref, HasPrev ? "" : "Off"));
  Nav.appendChild(Link("Chapters", "#", ""));
  Nav.appendChild(Link("Next", NextHref, HasNext ? "" : "Off"));

  App.innerHTML = "";
  var Title = Make("div", "ReaderTitle");
  Title.appendChild(Make("div", "BookName", Entry.Book.Title));
  Title.appendChild(Make("div", "ChapterName", Chapter.Title));
  var Counts = Make("div", "ChapterCounts", "");
  Title.appendChild(Counts);
  LoadCounts(Entry, Counts);
  App.appendChild(Title);

  var Reader = Make("div", "Reader");
  App.appendChild(Reader);
  LoadPages(Reader, Chapter, 0, Index);

  var Foot = Make("div", "Foot");
  Foot.appendChild(Link("Previous chapter", PrevHref, HasPrev ? "" : "Off"));
  var Original = OriginalLink(Entry.Book.OriginalUrl, "Btn");
  if (Original) Foot.appendChild(Original);
  Foot.appendChild(Link("Next chapter", NextHref, HasNext ? "" : "Off"));
  App.appendChild(Foot);
  AddComments(Entry);
  window.scrollTo(0, 0);
}

function Route() {
  var Index = FindByHash();
  if (Index < 0) RenderHome();
  else RenderChapter(Index);
}

window.addEventListener("hashchange", Route);
Route();

var UpdateBaseline = null;
var UpdateShown = false;

async function ReadSiteSignature() {
  var Response = await fetch("Version.json?Check=" + Date.now(), { cache: "no-store" });
  if (!Response.ok) return null;
  return await Response.text();
}

function ShowUpdateBanner() {
  if (UpdateShown) return;
  UpdateShown = true;
  var Banner = document.createElement("div");
  Banner.id = "UpdateBanner";
  Banner.innerHTML = "<span>New update! Reload to see it.</span>";
  var Button = document.createElement("button");
  Button.textContent = "Reload";
  Button.onclick = function () { location.reload(); };
  var Close = document.createElement("button");
  Close.textContent = "×";
  Close.className = "Dismiss";
  Close.onclick = function () { Banner.remove(); };
  Banner.appendChild(Button);
  Banner.appendChild(Close);
  document.body.appendChild(Banner);
}

async function CheckForUpdate() {
  try {
    var Current = await ReadSiteSignature();
    if (Current === null) return;
    if (UpdateBaseline === null) {
      UpdateBaseline = Current;
      return;
    }
    if (Current !== UpdateBaseline) ShowUpdateBanner();
  } catch (Error) {
  }
}

CheckForUpdate();
setInterval(CheckForUpdate, 60000);
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") CheckForUpdate();
});
