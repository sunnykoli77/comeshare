function handleAction(state, action) {
  if (action.type == "setUser") {
    localStorage.setItem("userName", action.user);
    return {...state, user: action.user};
  } else if (action.type == "toggleTalk") {
    return {...state, expandedTalk: action.talk};
  } else if (action.type == "toggleBack") {
    return {...state, expandedTalk: ""};
  } else if (action.type == "setTalks") {
    return {...state, talks: action.talks};
  } else if (action.type == "newTalk") {
    fetchOK(talkURL(action.title), {
      method: "PUT",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        presenter: state.user,
        summary: action.summary
      })
    }).catch(reportError);
  } else if (action.type == "deleteTalk") {
    fetchOK(talkURL(action.talk), {method: "DELETE"})
      .catch(reportError);
  } else if (action.type == "newComment") {
    fetchOK(talkURL(action.talk) + "/comments", {
      method: "POST",
      headers: {"Content-Type": "application/json"},
      body: JSON.stringify({
        author: state.user,
        message: action.message
      })
    }).catch(reportError);
  }
  return state;
}

function fetchOK(url, options) {
  return fetch(url, options).then(response => {
    if (response.status < 400) return response;
    else throw new Error(response.statusText);
  });
}

function talkURL(title) {
  return "/talks/" + encodeURIComponent(title);
}

function reportError(error) {
  alert(String(error));
}

function submitForm(event) {
    event.preventDefault();
    dispatch({type: "newTalk",
        title: event.target.title.value,
        summary: event.target.summary.value})
    event.target.reset();
    }

function elt(type, props, ...children) {
  let dom = document.createElement(type);
  if (props) Object.assign(dom, props);
  for (let child of children) {
    if (typeof child != "string") dom.appendChild(child);
    else dom.appendChild(document.createTextNode(child));
  }
  return dom;
}


function renderEntire(talk, dispatch) {
  return elt("div", null, 
    elt("button", {type: "button", style: "cursor: pointer", onclick() {
    dispatch({type: "toggleBack"})}}, "Back"), 
    elt("h2", null, talk.title),
    elt("p", null, talk.summary),
    ...talk.comments.map(renderComment),
    elt("form", {
      onsubmit(event) {
        event.preventDefault();
        let form = event.target;
        dispatch({type: "newComment",
                  talk: talk.title,
                  message: form.elements.comment.value});
        form.reset();
      }
    }, elt("input", {type: "text", name: "comment"}), " ",
       elt("button", {type: "submit"}, "Add comment")));
}

function renderTalk(talk, dispatch) {
  return elt("h2", {style: "cursor: pointer", onclick() {
    dispatch({type: "toggleTalk", talk: talk.title})}}, talk.title, " ", elt("button", {
      type: "button",
      onclick(event) {
        event.stopPropagation();
        dispatch({type: "deleteTalk", talk: talk.title});
      }
    }, "Delete"),
    elt("div", null, elt("span", null, "by ",
        elt("strong", null, talk.presenter))));
    }

function renderComment(comment) {
  return elt("p", {className: "comment"},
             elt("strong", null, comment.author),
             ": ", comment.message);
}

async function pollTalks(update) {
  let tag = undefined;
  for (;;) {
    let response;
    try {
      response = await fetchOK("/talks", {
        headers: tag && {"If-None-Match": tag,
                         "Prefer": "wait=90"}
      });
    } catch (e) {
      console.log("Request failed: " + e);
      await new Promise(resolve => setTimeout(resolve, 500));
      continue;
    }
    if (response.status == 304) continue;
    tag = response.headers.get("ETag");
    update(await response.json());
  }
}

class SkillShareApp {
  constructor(state, dispatch) {
    this.dispatch = dispatch;
    this.talkDOM = document.querySelector(".grid-talk");
    this.syncState(state);
  }

  syncState(state) {
    const objLength = state.expandedTalk.length;
    if (objLength > 0) {
      let entireTalk = state.talks.find(talk => talk.title === state.expandedTalk);
      this.talkDOM.textContent = "";
      this.talkDOM.appendChild(
        renderEntire(entireTalk, this.dispatch));
    } else if (state.talks != this.talks || objLength == 0) {
      this.talkDOM.textContent = "";
      for (let talk of state.talks) {
        this.talkDOM.appendChild(
          renderTalk(talk, this.dispatch));
      }
      this.talks = state.talks;
    }
  }
}

function runApp() {
  let user = localStorage.getItem("userName") || "Anon";
  let expandedTalk = new Set();
  let state, app;
  function dispatch(action) {
    state = handleAction(state, action);
    app.syncState(state);
  }
  
  document.getElementById("nameInput").addEventListener("change", function(event) {
    dispatch({type: "setUser", user: event.target.value});
  });

  document.getElementById("talkForm").addEventListener("submit", function(event) {
    event.preventDefault();
    dispatch({
      type: "newTalk",
      title: event.target.title.value,
      summary: event.target.summary.value
    });
    event.target.reset();
  });

  pollTalks(talks => {
    if (!app) {
      state = {user, talks, expandedTalk};
      app = new SkillShareApp(state, dispatch);
    } else {
      dispatch({type: "setTalks", talks});
    }
  }).catch(reportError);
}

runApp();


