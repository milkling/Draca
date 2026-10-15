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

function BookFolder(Book) {
  if (!Book.Chapters.length) return "";
  return Book.Chapters[0].Folder.split("/").slice(0, -1).join("/");
}

function BookCover(Book) {
  if (Book.Cover) return Book.Cover;
  var Folder = BookFolder(Book);
  return Folder ? Folder + "/Cover.jpg" : "";
}

function ChapterThumb(Chapter) {
  return Chapter.Thumb || Chapter.Folder + "/Thumb.jpg";
}

function FormatDate(Text) {
  var Match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(Text || "");
  if (!Match) return "";
  var Value = new Date(Number(Match[1]), Number(Match[2]) - 1, Number(Match[3]));
  return Value.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function DisclaimerBox() {
  var Box = Make("aside", "Disclaimer");
  Box.appendChild(Make("strong", "", "Disclaimer"));
  Box.appendChild(Make("p", "", "All artwork on this site was generated with AI. The story itself was written entirely by me. This is a non-commercial fan work made for fun: I earn no money from it, with no ads, sales or donations. Harry Potter and all related characters and settings belong to J.K. Rowling and her publishers. No ownership is claimed and no infringement is intended."));
  return Box;
}

function CountsText(Data) {
  var Views = Data.v || 0;
  var Likes = Data.l || 0;
  var Text = Views + (Views === 1 ? " view" : " views") + " \u00b7 " + Likes + (Likes === 1 ? " like" : " likes");
  if (typeof Data.c === "number") Text += " \u00b7 " + Data.c + (Data.c === 1 ? " comment" : " comments");
  return Text;
}

function ReadCommentCounts(Keys) {
  return fetch("/api/Comments?keys=" + Keys.join(","), { cache: "no-store" })
    .then(function (Response) { return Response.ok ? Response.json() : null; })
    .then(function (Data) { return Data && Data.counts ? Data.counts : null; })
    .catch(function () { return null; });
}

function ReadStats(Keys) {
  return fetch("/api/Stats?keys=" + Keys.join(","), { cache: "no-store" })
    .then(function (Response) { return Response.ok ? Response.json() : null; })
    .catch(function () { return null; });
}

function PostStat(Key, Action) {
  return fetch("/api/Stats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key: Key, action: Action })
  })
    .then(function (Response) { return Response.ok ? Response.json() : null; })
    .catch(function () { return null; });
}

function StorageGet(Name) {
  try { return localStorage.getItem(Name); } catch (Failure) { return null; }
}

function StorageSet(Name, Value) {
  try {
    if (Value === null) localStorage.removeItem(Name);
    else localStorage.setItem(Name, Value);
  } catch (Failure) {
  }
}

function SessionSeen(Name) {
  try {
    if (sessionStorage.getItem(Name)) return true;
    sessionStorage.setItem(Name, "1");
  } catch (Failure) {
  }
  return false;
}

function ReadKnown() {
  var Raw = StorageGet("KnownChapters");
  if (!Raw) return null;
  try {
    var List = JSON.parse(Raw);
    return Array.isArray(List) ? List : null;
  } catch (Failure) {
    return null;
  }
}

function WriteKnown(List) {
  StorageSet("KnownChapters", JSON.stringify(List));
}

function AllKeys() {
  return All.map(function (Item) { return Item.Key; });
}

function FindNewEntries() {
  var Known = ReadKnown();
  if (!Known) {
    WriteKnown(AllKeys());
    return [];
  }
  return All.filter(function (Item) { return Known.indexOf(Item.Key) < 0; });
}

function MarkKnown(Key) {
  var Known = ReadKnown();
  if (!Known) {
    WriteKnown(AllKeys());
    return;
  }
  if (Known.indexOf(Key) < 0) {
    Known.push(Key);
    WriteKnown(Known);
  }
}

var ScrollWatcher = null;
var ResumeIntent = null;
var ReadingArmedAt = 0;

function ReadBookmarks() {
  var Raw = StorageGet("Bookmarks");
  if (!Raw) return {};
  try {
    var Data = JSON.parse(Raw);
    return Data && typeof Data === "object" ? Data : {};
  } catch (Failure) {
    return {};
  }
}

function SaveBookmark(Key, Data) {
  var Marks = ReadBookmarks();
  Marks[Key] = Data;
  StorageSet("Bookmarks", JSON.stringify(Marks));
  StorageSet("LastRead", Key);
}

function ClearBookmark(Key) {
  var Marks = ReadBookmarks();
  delete Marks[Key];
  StorageSet("Bookmarks", JSON.stringify(Marks));
}

function StopWatchingScroll() {
  if (ScrollWatcher) {
    window.removeEventListener("scroll", ScrollWatcher);
    ScrollWatcher = null;
  }
}

function WatchReading(Entry, Reader) {
  StopWatchingScroll();
  var Timer = null;
  ReadingArmedAt = Date.now() + 1200;
  ScrollWatcher = function () {
    if (Date.now() < ReadingArmedAt || Timer) return;
    Timer = setTimeout(function () {
      Timer = null;
      var Current = FindByHash();
      if (Current < 0 || All[Current].Key !== Entry.Key) return;
      var Images = Reader.querySelectorAll("img");
      if (!Images.length || window.scrollY < 120) return;
      var Line = 90;
      var ReaderBox = Reader.getBoundingClientRect();
      if (ReaderBox.bottom < window.innerHeight + 150) {
        SaveBookmark(Entry.Key, { Page: Images.length - 1, Offset: 0, Done: true });
        return;
      }
      for (var I = 0; I < Images.length; I++) {
        var Box = Images[I].getBoundingClientRect();
        if (Box.top <= Line && Box.bottom > Line) {
          SaveBookmark(Entry.Key, { Page: I, Offset: Math.round(((Line - Box.top) / Box.height) * 1000) / 1000, Done: false });
          return;
        }
      }
    }, 400);
  };
  window.addEventListener("scroll", ScrollWatcher, { passive: true });
}

function ResumeTo(Reader, Saved) {
  var Tries = 0;
  function Attempt() {
    var Images = Reader.querySelectorAll("img");
    if (Images.length > Saved.Page) {
      var Image = Images[Saved.Page];
      var Top = Image.getBoundingClientRect().top + window.scrollY;
      ReadingArmedAt = Date.now() + 1200;
      window.scrollTo(0, Math.max(0, Top + Image.height * (Saved.Offset || 0) - 90));
      return;
    }
    Tries++;
    if (Tries < 80) setTimeout(Attempt, 250);
  }
  Attempt();
}

var HomeStats = null;

function LoadCounts(Entry, Target) {
  if (!HomeStats) {
    var Keys = All.map(function (Item) { return Item.Key; });
    HomeStats = Promise.all([ReadStats(Keys), ReadCommentCounts(Keys)]);
  }
  HomeStats.then(function (Pair) {
    var Stats = Pair[0];
    var Counts = Pair[1];
    if (!Stats) { Target.textContent = ""; return; }
    var Data = { v: 0, l: 0 };
    var Found = Stats[Entry.Key] || {};
    Data.v = Found.v || 0;
    Data.l = Found.l || 0;
    if (Counts) Data.c = Counts[Entry.Key] || 0;
    Target.textContent = CountsText(Data);
  });
}

var MusicAudio = null;
var MusicSrc = "";
var MusicButton = null;
var MusicBlocked = false;

function MusicWanted() {
  return StorageGet("MusicOn") !== "0";
}

function FadeAudio(Target, Level, Duration, Done) {
  var Start = Target.volume;
  var Begin = Date.now();
  function Tick() {
    var Progress = Math.min((Date.now() - Begin) / Duration, 1);
    Target.volume = Math.max(0, Math.min(1, Start + (Level - Start) * Progress));
    if (Progress < 1) setTimeout(Tick, 40);
    else if (Done) Done();
  }
  Tick();
}

function UpdateMusicButton() {
  if (!MusicButton) return;
  var On = MusicWanted() && !MusicBlocked;
  MusicButton.textContent = On ? "\u266a On" : "\u266a Off";
  MusicButton.className = "MusicButton" + (On ? " On" : "");
}

function StopMusic() {
  if (MusicAudio) {
    var Old = MusicAudio;
    MusicAudio = null;
    FadeAudio(Old, 0, 800, function () { Old.pause(); });
  }
  MusicSrc = "";
}

function PlayMusic(Src, Volume) {
  if (Src === MusicSrc) return;
  StopMusic();
  MusicSrc = Src;
  if (!Src) return;
  var Track = new Audio(Src);
  Track.loop = true;
  Track.volume = 0;
  MusicAudio = Track;
  if (!MusicWanted()) return;
  Track.play().then(function () {
    MusicBlocked = false;
    UpdateMusicButton();
    FadeAudio(Track, Volume || 0.5, 1500);
  }).catch(function () {
    MusicBlocked = true;
    UpdateMusicButton();
  });
}

function ShowMusicButton(Visible) {
  if (!MusicButton) {
    MusicButton = document.createElement("button");
    MusicButton.onclick = function () {
      if (MusicBlocked) {
        MusicBlocked = false;
        StorageSet("MusicOn", "1");
        var Pending = MusicSrc;
        MusicSrc = "";
        PlayMusic(Pending, PendingVolume);
      } else if (MusicWanted()) {
        StorageSet("MusicOn", "0");
        if (MusicAudio) FadeAudio(MusicAudio, 0, 400, function () { if (MusicAudio) MusicAudio.pause(); });
      } else {
        StorageSet("MusicOn", "1");
        if (MusicAudio) {
          var Resume = MusicAudio;
          Resume.play().then(function () { FadeAudio(Resume, PendingVolume, 800); }).catch(function () {
            MusicBlocked = true;
            UpdateMusicButton();
          });
        }
      }
      UpdateMusicButton();
    };
    document.body.appendChild(MusicButton);
  }
  MusicButton.hidden = !Visible;
  UpdateMusicButton();
}

var PendingVolume = 0.5;

function WatchMusic(Img, Chapter, PageIndex, ChapterIndex) {
  if (!Chapter.Music || !("IntersectionObserver" in window)) return;
  var Cue = Chapter.Music.filter(function (Item) { return Item.Page === PageIndex + 1; })[0];
  if (!Cue) return;
  var Watcher = new IntersectionObserver(function (Entries) {
    if (!Entries[0].isIntersecting) return;
    if (FindByHash() !== ChapterIndex) { Watcher.disconnect(); return; }
    PendingVolume = Cue.Volume || 0.5;
    PlayMusic(Cue.Src, PendingVolume);
    Watcher.disconnect();
  }, { threshold: 0.25 });
  Watcher.observe(Img);
}

function RenderHome() {
  StopWatchingScroll();
  StopMusic();
  ShowMusicButton(false);
  HomeStats = null;
  var Fresh = FindNewEntries();
  var FreshKeys = Fresh.map(function (Item) { return Item.Key; });
  document.title = (Fresh.length ? "(" + Fresh.length + ") " : "") + SiteInfo.Title;
  Nav.innerHTML = "";
  App.innerHTML = "";
  var Wrap = Make("div", "Home");

  var Hero = Make("div", "Hero");
  var Backdrop = Make("div", "HeroBackdrop");
  var Cover = Make("img", "Cover");
  Cover.src = SiteInfo.Cover;
  Cover.alt = "";
  Cover.onerror = function () {
    Cover.onerror = function () { Cover.remove(); };
    Cover.src = BookCover(Books[0]);
  };
  Backdrop.appendChild(Cover);
  Hero.appendChild(Backdrop);

  var Text = Make("div", "HeroText");
  Text.appendChild(Make("div", "HeroKicker", "A Harry Potter retelling"));
  Text.appendChild(Make("h1", "", SiteInfo.Title));
  Text.appendChild(Make("p", "", SiteInfo.Tagline));
  var Actions = Make("div", "Actions");
  var Marks = ReadBookmarks();
  var LastKey = StorageGet("LastRead");
  var Last = All.filter(function (Item) { return Item.Key === LastKey; })[0];
  if (All.length > 0) {
    var Start = null;
    if (Last) {
      var Target = Last;
      var Label = "Continue: " + Last.Chapter.Title;
      var LastMark = Marks[Last.Key] || {};
      var Following = All[All.indexOf(Last) + 1];
      if (LastMark.Done && Following) {
        Target = Following;
        Label = "Next: " + Following.Chapter.Title;
      } else if (LastMark.Done) {
        Label = "Reread: " + Last.Chapter.Title;
      }
      Start = Make("a", "Start", Label);
      Start.href = "#" + Target.Key;
      Start.onclick = function () { ResumeIntent = Target.Key; };
    } else {
      Start = Make("a", "Start", "Start reading");
      Start.href = "#" + All[0].Key;
    }
    Actions.appendChild(Start);
    var Latest = Make("a", "Latest", "Latest chapter");
    Latest.href = "#" + All[All.length - 1].Key;
    Actions.appendChild(Latest);
  }
  var Original = OriginalLink("", "Original");
  if (Original) Actions.appendChild(Original);
  Text.appendChild(Actions);
  Hero.appendChild(Text);
  Wrap.appendChild(Hero);

  if (Fresh.length) {
    var Banner = Make("a", "NewBanner");
    Banner.href = "#" + Fresh[0].Key;
    var Newest = Fresh[Fresh.length - 1];
    var Headline = Fresh.length === 1
      ? "New chapter: " + Newest.Chapter.Title
      : Fresh.length + " new chapters since your last visit";
    Banner.appendChild(Make("span", "NewBannerTitle", Headline));
    Banner.appendChild(Make("span", "NewBannerGo", Fresh.length === 1 ? "Read now" : "Start with " + Fresh[0].Chapter.Title));
    Wrap.appendChild(Banner);
  }

  Books.forEach(function (Book, BookIndex) {
    var Section = Make("section", "Book");
    var Head = Make("div", "BookHead");
    var CoverSrc = BookCover(Book);
    if (CoverSrc) {
      var BookArt = Make("img", "BookCover");
      BookArt.src = CoverSrc;
      BookArt.alt = "";
      BookArt.onerror = function () { BookArt.remove(); };
      Head.appendChild(BookArt);
    }
    var HeadText = Make("div", "BookHeadText");
    HeadText.appendChild(Make("h2", "", Book.Title));
    var Meta = Make("div", "BookMeta");
    if (Book.Status) {
      var Level = Book.Status.toLowerCase();
      var StatusClass = Level === "complete" ? " Complete" : Level === "coming soon" ? " Soon" : " Ongoing";
      Meta.appendChild(Make("span", "BookStatus" + StatusClass, Book.Status));
    }
    if (Book.Chapters.length) {
      Meta.appendChild(Make("span", "BookCount", Book.Chapters.length + (Book.Chapters.length === 1 ? " chapter" : " chapters")));
    }
    HeadText.appendChild(Meta);
    var BookLink = Book.OriginalUrl ? OriginalLink(Book.OriginalUrl, "BookLink") : null;
    if (BookLink) HeadText.appendChild(BookLink);
    Head.appendChild(HeadText);
    Section.appendChild(Head);

    if (!Book.Chapters.length) {
      Section.appendChild(Make("div", "ComingSoon", "Chapters are on the way. Check back soon!"));
      Wrap.appendChild(Section);
      return;
    }

    var List = Make("div", "List");
    Book.Chapters.forEach(function (Chapter, ChapterIndex) {
      var Entry = All.filter(function (Item) {
        return Item.BookIndex === BookIndex && Item.ChapterIndex === ChapterIndex;
      })[0];
      var Row = Make("a", "Row");
      Row.href = "#" + Entry.Key;
      var Thumb = Make("img", "Thumb");
      Thumb.src = ChapterThumb(Chapter);
      Thumb.alt = "";
      Thumb.loading = "lazy";
      Thumb.onerror = function () { Thumb.style.visibility = "hidden"; };
      Row.appendChild(Thumb);
      var Body = Make("span", "RowBody");
      var TitleNode = Make("span", "RowTitle", Chapter.Title);
      if (FreshKeys.indexOf(Entry.Key) >= 0) TitleNode.appendChild(Make("span", "NewTag", "New"));
      var RowMark = Marks[Entry.Key];
      if (RowMark && RowMark.Done) TitleNode.appendChild(Make("span", "ReadTag", "Read"));
      else if (RowMark) TitleNode.appendChild(Make("span", "ReadTag Active", "Page " + (RowMark.Page + 1)));
      Body.appendChild(TitleNode);
      var DateText = FormatDate(Chapter.Date);
      if (DateText) Body.appendChild(Make("span", "RowDate", DateText));
      var Counts = Make("span", "RowCounts", "");
      Body.appendChild(Counts);
      Row.appendChild(Body);
      Row.appendChild(Make("span", "RowNum", "#" + (ChapterIndex + 1)));
      List.appendChild(Row);
      LoadCounts(Entry, Counts);
    });
    Section.appendChild(List);
    Wrap.appendChild(Section);
  });

  Wrap.appendChild(DisclaimerBox());
  Wrap.appendChild(Make("footer", "SiteFoot", "Draca \u00b7 written by inachane"));
  App.appendChild(Wrap);
  window.scrollTo(0, 0);
}

function PostJson(Url, Payload) {
  return fetch(Url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(Payload)
  })
    .then(function (Response) {
      return Response.json().catch(function () { return {}; }).then(function (Data) {
        Data.Status = Response.status;
        return Data;
      });
    })
    .catch(function () { return { error: "Offline", Status: 0 }; });
}

function TimeAgo(Time) {
  var Seconds = Math.max(1, Math.floor((Date.now() - Time) / 1000));
  if (Seconds < 60) return "just now";
  var Minutes = Math.floor(Seconds / 60);
  if (Minutes < 60) return Minutes + (Minutes === 1 ? " minute ago" : " minutes ago");
  var Hours = Math.floor(Minutes / 60);
  if (Hours < 24) return Hours + (Hours === 1 ? " hour ago" : " hours ago");
  var Days = Math.floor(Hours / 24);
  if (Days < 30) return Days + (Days === 1 ? " day ago" : " days ago");
  return new Date(Time).toLocaleDateString();
}

var CommentErrors = {
  BadName: "Names are 3 to 20 letters or numbers, no spaces.",
  Taken: "That name is already taken.",
  Slow: "Slow down a little, try again in a few seconds.",
  BadLogin: "That name and code do not match.",
  Empty: "Write something first.",
  TooLong: "That comment is too long.",
  Offline: "Could not reach the server.",
  NoStore: "Comments are not set up yet."
};

function AddComments(Entry) {
  var Box = Make("section", "Comments");
  var Head = Make("h3", "CommentsHead", "Comments");
  Box.appendChild(Head);

  var Account = Make("div", "CommentAccount");
  var Form = Make("form", "CommentForm");
  var Field = Make("textarea", "CommentField");
  Field.placeholder = "Say something nice...";
  Field.maxLength = 1000;
  Field.rows = 3;
  var Bar = Make("div", "CommentBar");
  var Status = Make("span", "CommentStatus", "");
  var Submit = Make("button", "CommentSubmit", "Post");
  Submit.type = "submit";
  Bar.appendChild(Status);
  Bar.appendChild(Submit);
  Form.appendChild(Field);
  Form.appendChild(Bar);

  var ListBox = Make("div", "CommentList");
  Box.appendChild(Account);
  Box.appendChild(Form);
  Box.appendChild(ListBox);
  App.appendChild(Box);

  var Name = StorageGet("CommentName");
  var Token = StorageGet("CommentToken");
  var Comments = [];

  function Say(Text, Bad) {
    Status.textContent = Text || "";
    Status.className = "CommentStatus" + (Bad ? " Bad" : "");
  }

  function ErrorText(Data) {
    return CommentErrors[Data.error] || "Something went wrong.";
  }

  function ShowList() {
    ListBox.innerHTML = "";
    Head.textContent = Comments.length ? "Comments (" + Comments.length + ")" : "Comments";
    if (!Comments.length) {
      ListBox.appendChild(Make("div", "CommentEmpty", "No comments yet. Be the first!"));
      return;
    }
    Comments.slice().reverse().forEach(function (Item) {
      var Card = Make("div", "CommentItem");
      var Top = Make("div", "CommentTop");
      Top.appendChild(Make("span", "CommentName" + (Item.member ? " Member" : ""), Item.name));
      Top.appendChild(Make("span", "CommentTime", TimeAgo(Item.time)));
      if (Item.member && Name && Item.name.toLowerCase() === Name.toLowerCase()) {
        var Remove = Make("button", "CommentRemove", "Delete");
        Remove.type = "button";
        Remove.onclick = function () {
          PostJson("/api/Comments", { action: "delete", key: Entry.Key, id: Item.id, name: Name, token: Token }).then(function (Data) {
            if (Data.ok) {
              Comments = Comments.filter(function (Other) { return Other.id !== Item.id; });
              ShowList();
            } else {
              Say(ErrorText(Data), true);
            }
          });
        };
        Top.appendChild(Remove);
      }
      Card.appendChild(Top);
      Card.appendChild(Make("div", "CommentText", Item.text));
      ListBox.appendChild(Card);
    });
  }

  function ShowAccount() {
    Account.innerHTML = "";
    if (Name && Token) {
      var Line = Make("div", "CommentLine");
      Line.appendChild(Make("span", "", "Posting as "));
      Line.appendChild(Make("strong", "", Name));
      var Code = Make("button", "CommentLink", "Show my code");
      Code.type = "button";
      Code.onclick = function () {
        Say("Your sign-in code: " + Token + " (use it to sign in on another device)", false);
      };
      var Out = Make("button", "CommentLink", "Sign out");
      Out.type = "button";
      Out.onclick = function () {
        Name = null;
        Token = null;
        StorageSet("CommentName", null);
        StorageSet("CommentToken", null);
        Say("");
        ShowAccount();
        ShowList();
      };
      Line.appendChild(Code);
      Line.appendChild(Out);
      Account.appendChild(Line);
      return;
    }
    var Line2 = Make("div", "CommentLine");
    Line2.appendChild(Make("span", "", "Posting as Anonymous. "));
    var Pick = Make("button", "CommentLink", "Pick a username");
    Pick.type = "button";
    var Sign = Make("button", "CommentLink", "I already have one");
    Sign.type = "button";
    Line2.appendChild(Pick);
    Line2.appendChild(Sign);
    Account.appendChild(Line2);

    function Panel(Mode) {
      var Wrap = Make("form", "CommentJoin");
      var NameInput = Make("input", "CommentInput");
      NameInput.placeholder = "Username";
      NameInput.maxLength = 20;
      NameInput.autocomplete = "off";
      Wrap.appendChild(NameInput);
      var CodeInput = null;
      if (Mode === "login") {
        CodeInput = Make("input", "CommentInput");
        CodeInput.placeholder = "Sign-in code";
        CodeInput.autocomplete = "off";
        Wrap.appendChild(CodeInput);
      }
      var Go = Make("button", "CommentSubmit", Mode === "login" ? "Sign in" : "Create");
      Go.type = "submit";
      Wrap.appendChild(Go);
      Wrap.onsubmit = function (Event) {
        Event.preventDefault();
        Go.disabled = true;
        var Payload = Mode === "login"
          ? { action: "login", name: NameInput.value.trim(), token: CodeInput.value }
          : { action: "register", name: NameInput.value.trim() };
        PostJson("/api/Comments", Payload).then(function (Data) {
          Go.disabled = false;
          if (Data.name && Data.token) {
            Name = Data.name;
            Token = Data.token;
            StorageSet("CommentName", Name);
            StorageSet("CommentToken", Token);
            ShowAccount();
            Say(Mode === "login" ? "Signed in." : "Welcome, " + Name + "! Your sign-in code is " + Token + ". Save it if you want to use this name on another device.", false);
          } else {
            Say(ErrorText(Data), true);
          }
        });
      };
      return Wrap;
    }

    var Open = null;
    function Toggle(Mode) {
      if (Open) { Open.remove(); Open = null; }
      Open = Panel(Mode);
      Account.appendChild(Open);
    }
    Pick.onclick = function () { Toggle("register"); };
    Sign.onclick = function () { Toggle("login"); };
  }

  Form.onsubmit = function (Event) {
    Event.preventDefault();
    var Text = Field.value.trim();
    if (!Text) { Say(CommentErrors.Empty, true); return; }
    Submit.disabled = true;
    var Payload = { action: "post", key: Entry.Key, text: Text };
    if (Name && Token) {
      Payload.name = Name;
      Payload.token = Token;
    }
    PostJson("/api/Comments", Payload).then(function (Data) {
      Submit.disabled = false;
      if (Data.comment) {
        Comments.push(Data.comment);
        Field.value = "";
        Say("");
        ShowList();
      } else {
        if (Data.error === "BadLogin") {
          Name = null;
          Token = null;
          StorageSet("CommentName", null);
          StorageSet("CommentToken", null);
          ShowAccount();
        }
        Say(ErrorText(Data), true);
      }
    });
  };

  ShowAccount();
  ListBox.appendChild(Make("div", "CommentEmpty", "Loading comments..."));
  fetch("/api/Comments?key=" + Entry.Key, { cache: "no-store" })
    .then(function (Response) { return Response.ok ? Response.json() : null; })
    .catch(function () { return null; })
    .then(function (Data) {
      if (!Data) {
        ListBox.innerHTML = "";
        ListBox.appendChild(Make("div", "CommentEmpty", "Comments could not be loaded."));
        return;
      }
      Comments = Data.comments || [];
      ShowList();
    });
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
    WatchMusic(Img, Chapter, PageIndex, ChapterIndex);
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
  MarkKnown(Entry.Key);
  Nav.innerHTML = "";
  var HasPrev = Index > 0;
  var HasNext = Index < All.length - 1;
  var PrevHref = HasPrev ? "#" + All[Index - 1].Key : "#" + Entry.Key;
  var NextHref = HasNext ? "#" + All[Index + 1].Key : "#" + Entry.Key;
  Nav.appendChild(Link("Prev", PrevHref, HasPrev ? "" : "Off"));
  Nav.appendChild(Link("Chapters", "#", ""));
  Nav.appendChild(Link("Next", NextHref, HasNext ? "" : "Off"));

  StopWatchingScroll();
  StopMusic();
  ShowMusicButton(!!Chapter.Music);
  App.innerHTML = "";
  var Title = Make("div", "ReaderTitle");
  Title.appendChild(Make("div", "BookName", Entry.Book.Title));
  Title.appendChild(Make("div", "ChapterName", Chapter.Title));
  var PublishedText = FormatDate(Chapter.Date);
  if (PublishedText) Title.appendChild(Make("div", "ChapterDate", "Published " + PublishedText));
  var Counts = Make("div", "ChapterCounts", "");
  Title.appendChild(Counts);
  var LikeName = "Liked" + Entry.Key;
  var Liked = StorageGet(LikeName) === "1";
  var LikeButton = Make("button", "LikeButton", "");
  var Latest = { v: 0, l: 0 };
  function ShowStats(Data) {
    if (!Data) return;
    Latest = Data;
    Counts.textContent = CountsText(Data);
  }
  function ShowLike() {
    LikeButton.textContent = Liked ? "\u2665 Liked" : "\u2661 Like";
    LikeButton.className = "LikeButton" + (Liked ? " On" : "");
  }
  ShowLike();
  LikeButton.onclick = function () {
    Liked = !Liked;
    StorageSet(LikeName, Liked ? "1" : null);
    ShowLike();
    ShowStats({ v: Latest.v, l: Math.max(0, Latest.l + (Liked ? 1 : -1)) });
    PostStat(Entry.Key, Liked ? "like" : "unlike").then(ShowStats);
  };
  Title.appendChild(LikeButton);
  if (SessionSeen("Viewed" + Entry.Key)) {
    ReadStats([Entry.Key]).then(function (Stats) { if (Stats) ShowStats(Stats[Entry.Key]); });
  } else {
    PostStat(Entry.Key, "view").then(ShowStats);
  }
  App.appendChild(Title);

  var Reader = Make("div", "Reader");
  App.appendChild(Reader);
  var Saved = ReadBookmarks()[Entry.Key];
  var Resuming = ResumeIntent === Entry.Key;
  ResumeIntent = null;
  if (Saved && !Saved.Done && Resuming) {
    ResumeTo(Reader, Saved);
  } else if (Saved && !Saved.Done && (Saved.Page > 0 || Saved.Offset > 0.1)) {
    var Bar = Make("div", "ResumeBar");
    Bar.appendChild(Make("span", "", "You stopped at page " + (Saved.Page + 1)));
    var Go = Make("button", "ResumeGo", "Continue");
    Go.type = "button";
    Go.onclick = function () {
      Bar.remove();
      ResumeTo(Reader, Saved);
    };
    var Again = Make("button", "ResumeAgain", "Start over");
    Again.type = "button";
    Again.onclick = function () {
      Bar.remove();
      ClearBookmark(Entry.Key);
    };
    Bar.appendChild(Go);
    Bar.appendChild(Again);
    App.insertBefore(Bar, Reader);
  }
  LoadPages(Reader, Chapter, 0, Index);
  WatchReading(Entry, Reader);

  var Foot = Make("div", "Foot");
  Foot.appendChild(Link("Previous chapter", PrevHref, HasPrev ? "" : "Off"));
  var Original = OriginalLink(Entry.Book.OriginalUrl, "Btn");
  if (Original) Foot.appendChild(Original);
  Foot.appendChild(Link("Next chapter", NextHref, HasNext ? "" : "Off"));
  App.appendChild(Foot);
  App.appendChild(DisclaimerBox());
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
var WatchedFiles = ["index.html", "App.js", "Chapters.js", "Style.css"];

function HashText(Text) {
  var Hash = 5381;
  for (var I = 0; I < Text.length; I++) Hash = ((Hash * 33) ^ Text.charCodeAt(I)) >>> 0;
  return Hash;
}

async function ReadSiteSignature(Fresh) {
  var Parts = [];
  for (var Name of WatchedFiles) {
    var Url = Fresh ? Name + "?Check=" + Date.now() : Name;
    var Response = await fetch(Url, { cache: Fresh ? "no-store" : "force-cache" });
    if (!Response.ok) return null;
    Parts.push(HashText(await Response.text()));
  }
  return Parts.join("-");
}

function ShowUpdateBanner() {
  if (UpdateShown) return;
  UpdateShown = true;
  document.title = "(Update) " + document.title;
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
  if (UpdateShown) return;
  try {
    if (UpdateBaseline === null) {
      UpdateBaseline = await ReadSiteSignature(false);
      if (UpdateBaseline === null) return;
    }
    var Current = await ReadSiteSignature(true);
    if (Current === null) return;
    if (Current !== UpdateBaseline) ShowUpdateBanner();
  } catch (Error) {
  }
}

CheckForUpdate();
setInterval(CheckForUpdate, 60000);
document.addEventListener("visibilitychange", function () {
  if (document.visibilityState === "visible") CheckForUpdate();
});
window.addEventListener("focus", CheckForUpdate);
