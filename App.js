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

function PageName(Index) {
  return "Page" + (Index + 1) + ".png";
}

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
  var Comments = Data.totalCommentCount || 0;
  var Likes = Data.reactionCount || 0;
  return Comments + (Comments === 1 ? " comment" : " comments") + " · " + Likes + (Likes === 1 ? " like" : " likes");
}

function LoadCounts(Entry, Target) {
  var Config = SiteInfo.Giscus;
  if (!Config || !Config.Repo || !Config.Category) return;
  var Url = "https://giscus.app/api/discussions?repo=" + encodeURIComponent(Config.Repo) +
    "&term=" + encodeURIComponent(Entry.Key) +
    "&category=" + encodeURIComponent(Config.Category) +
    "&number=0&strict=false";
  fetch(Url)
    .then(function (Response) { return Response.json(); })
    .then(function (Body) {
      if (Body && Body.discussion) Target.textContent = CountsText(Body.discussion);
      else Target.textContent = "0 comments · 0 likes";
    })
    .catch(function () { Target.textContent = ""; });
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
      var Meta = Make("span", "RowMeta", Chapter.Pages + (Chapter.Pages === 1 ? " page" : " pages"));
      Row.appendChild(Meta);
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
  for (var I = 0; I < Chapter.Pages; I++) {
    var Img = document.createElement("img");
    Img.src = Chapter.Folder + "/" + PageName(I);
    Img.alt = Chapter.Title + " page " + (I + 1);
    Img.loading = I < 2 ? "eager" : "lazy";
    Reader.appendChild(Img);
  }
  App.appendChild(Reader);

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
