import express from "express";
import {
  appendFile,
  appendFileSync,
  existsSync,
  mkdir,
  mkdirSync,
  readFileSync,
  rm,
  rmSync,
  writeFile,
  writeFileSync,
} from "fs";
import { join, sep } from "path";

const app = express();
app.use(
  express.json({
    limit: "1gb",
  })
);

const baseDir = join(__dirname, "..");
const resultDir = join(baseDir, "result");
const tempDir = join(baseDir, "temp");

//ensure temp
mkdirSync(tempDir, {
  recursive: true,
});
mkdirSync(resultDir, {
  recursive: true,
});

function uuidV4() {
  const uuid = new Array(36);
  for (let i = 0; i < 36; i++) {
    uuid[i] = Math.floor(Math.random() * 16);
  }
  uuid[14] = 4; // set bits 12-15 of time-high-and-version to 0100
  uuid[19] = uuid[19] &= ~(1 << 2); // set bit 6 of clock-seq-and-reserved to zero
  uuid[19] = uuid[19] |= 1 << 3; // set bit 7 of clock-seq-and-reserved to one
  uuid[8] = uuid[13] = uuid[18] = uuid[23] = "-";
  return uuid.map((x) => x.toString(16)).join("");
}

app.post("/alloc", (req, res) => {
  const body = req.body as {
    relativePath: string;
  };
  const uuid = uuidV4();
  writeFileSync(join(tempDir, uuid), btoa(body.relativePath));
  res.status(200).send(uuid);
});

app.post("/upload", (req, res) => {
  const body = req.body as {
    id: string;
    chunkIndex: number;
    data: string;
  };

  const uuid = uuidV4();
  const configFile = join(tempDir, body.id);
  if (!existsSync(configFile)) return res.status(400).send("Invalid ID");
  appendFileSync(configFile, "!" + uuid);

  writeFile(join(tempDir, uuid), Buffer.from(body.data, "ascii"), () => {
    res.status(200).send(uuid);
  });
});

app.post("/finalize", (req, res) => {
  const id = req.body.id as string;
  const files = readFileSync(join(tempDir, id), "ascii")
    .split("!")
    .filter((x) => x.trim().length > 0);

  const filename = atob(files[0]);

  const file = join(resultDir, filename);
  const dir = file.split(sep).slice(0, -1).join(sep);
  mkdirSync(dir, {
    recursive: true,
  });
  writeFileSync(file, "");

  //   console.log(files);

  for (let i = 1; i < files.length; i++) {
    const filechunk = files[i];
    appendFileSync(file, readFileSync(join(tempDir, filechunk)));
    rmSync(join(tempDir, filechunk));
  }

  rmSync(join(tempDir, id));

  res.status(200).send();
});

app.listen(4000, () => {
  console.log("Listening on port 4000");
});
