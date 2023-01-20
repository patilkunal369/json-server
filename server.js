const fs = require("fs");
const bodyParser = require("body-parser");
const jsonServer = require("json-server");
const jwt = require("jsonwebtoken");
const { v4: uuid } = require("uuid");
const server = jsonServer.create();
const router = jsonServer.router("./database.json");
const database = JSON.parse(fs.readFileSync("./database.json", "UTF-8"));

server.use(bodyParser.urlencoded({ extended: true }));
server.use(bodyParser.json());
server.use(jsonServer.defaults());

const SECRET_KEY = "123456789";

// const expiresIn = "1h";

// Create a token from a payload
function createToken(payload) {
  return jwt.sign(payload, SECRET_KEY); //, { expiresIn }
}

// Verify the token
function verifyToken(token) {
  return jwt.verify(token, SECRET_KEY, (err, decode) =>
    decode !== undefined ? decode : err
  );
}

// Check if the user exists in database
function isAuthenticated({ email }) {
  console.log(email);
  return database.users.findIndex((user) => user.email === email) !== -1;
}

server.use(function (req, res, next) {
  setTimeout(next, 3000);
});

// Register New User
server.post("/auth/register", (req, res) => {
  console.log("register endpoint called; request body:");
  console.log(req.body);
  const { email, password, username } = req.body;

  if (isAuthenticated({ email }) === true) {
    const status = 401;
    const message = "Email and Password already exist";
    res.status(status).json({ status, message });
    return;
  }

  //Add new user
  database.users.push({
    id: uuid(),
    email: email,
    password: password,
    username: username,
  }); //add some data

  fs.writeFile("./database.json", JSON.stringify(database), (err, result) => {
    if (err) {
      const status = 401;
      const message = err;
      res.status(status).json({ status, message });
      return;
    }
  });

  // Create token for new user
  const access_token = createToken({ email, password });
  console.log("Access Token:" + access_token);
  res.status(200).json({ access_token });
});

// Login to one of the users from ./users.json
server.post("/auth/login", (req, res) => {
  console.log("login endpoint called; request body:");
  console.log(req.body);
  const { email, password } = req.body;
  if (isAuthenticated({ email }) === false) {
    const status = 401;
    const message = "Incorrect email or password";
    res.status(status).json({ status, message });
    return;
  }
  const access_token = createToken({ email, password });
  const user = database.users.filter(
    (user) => user.email === email && user.password === password
  );

  console.log("Access Token:" + access_token);
  res.status(200).json({ access_token, ...user[0] });
});

server.use(/^(?!\/auth).*$/, (req, res, next) => {
  if (
    req.headers.authorization === undefined ||
    req.headers.authorization.split(" ")[0] !== "Bearer"
  ) {
    const status = 401;
    const message = "Error in authorization format";
    res.status(status).json({ status, message });
    return;
  }
  try {
    let verifyTokenResult;
    verifyTokenResult = verifyToken(req.headers.authorization.split(" ")[1]);

    if (verifyTokenResult instanceof Error) {
      const status = 401;
      const message = "Access token not provided";
      res.status(status).json({ status, message });
      return;
    }
    next();
  } catch (err) {
    const status = 401;
    const message = "Error access_token is revoked";
    res.status(status).json({ status, message });
  }
});

server.get("/boards", (req, res) => {
  const {
    query: { userId },
  } = req;

  if (!userId) {
    const status = 404;
    const message = "Please provide a userId";
    res.status(status).json({ status, message });
    y;

    return;
  }

  const boards = database.boards.filter((board) => {
    return board.members.includes(userId);
  });

  const userBoards = boards.map((board) => {
    const userDetails = board.members.map((memberID) => {
      const user = database.users.filter((user) => user.id === memberID)[0];
      return {
        username: user.username,
        id: user.id,
      };
    });

    return {
      ...board,
      members: userDetails,
    };
  });

  res.status(200).json({ boards: userBoards });
});

server.post("/inviteUser", (req, res) => {
  const invitedUsers = req.body;

  if (!isAuthenticated({ email: invitedUsers.email })) {
    const status = 401;
    const message = "User does not exist";
    res.status(status).json({ status, message });
    return;
  }
  database.boards.map((board) => {
    if (board.id === invitedUsers.boardId) {
      board.members.push(invitedUsers.userId);
    }
    return board;
  });

  fs.writeFile("./database.json", JSON.stringify(database), (err, result) => {
    if (err) {
      const status = 401;
      const message = err;
      res.status(status).json({ status, message });
      return;
    } else {
      res.status(200).json({ message: "Users invited" });
    }
  });
});

server.get("/isInvited", (req, res) => {
  const {
    query: { email },
  } = req;

  const user = database.users.find((user) => user.email === email);

  if (user.isInvited) {
    res
      .status(200)
      .json({ isInvited: true, message: "User has an invitation" });
  } else {
    const status = 401;
    const message = "User doesn't have an invitation";
    res.status(status).json({ status, message });
    return;
  }
});
server.get("/users", (req, res) => {
  const users = database.users.map((user) => {
    return {
      email: user.email,
      id: user.id,
    };
  });

  res.status(200).json(users);
});

server.use(router);

server.listen(8000, () => {
  console.log("Run Auth API Server");
});
