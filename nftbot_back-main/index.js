const fs = require("fs");
const cors = require("cors");
const moment = require("moment");
const express = require("express");
const mongoose = require("mongoose");
const Todo = require("./models/Todo");
const Logging = require("./models/Logging");
const Tracking = require("./models/Tracking");
const { trackSalesOnTestNet } = require("./utils/testnet");
const { generateImage } = require("./utils/generateImage");
const { deployContract, mintNFT, listForSale } = require("./utils/deployNFT");
const {
  COMPLETED,
  PENDING,
  IMAGE_GENERATION,
  NFT_MINT,
  LIST_FOR_SALE,
  NFT_DEPLOY,
} = require("./config/constants");
const filePath = "log.txt";
const { postPinataMetaData } = require("./utils/metadata");
const NftType = require("./models/NftType");

require("dotenv").config();

let isRunning = false; // Track whether the task is running

const app = express();

// Allow access from multiple domains
const allowedOrigins = ["http://localhost:3000"];

const corsOptions = {
  origin: allowedOrigins,
  optionsSuccessStatus: 200, // some legacy browsers (IE11, various SmartTVs) choke on 204
};
app.use(cors(corsOptions));

app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});
app.use(express.json());
const db_url = process.env.MONGO_DB_URL;
mongoose
  .connect(db_url, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("MongoDB connected successfully"))
  .catch((err) => console.log("MongoDB connection error:", err));

app.get("/api/todos/:status", async (req, res) => {
  try {
    const { status } = req.params;
    let todos;
    if (status === "All") {
      todos = await Todo.find().sort({ order: 1 });
    } else if (status === "Processing") {
      todos = await Todo.find({
        status: { $nin: [PENDING, COMPLETED] },
      }).sort({ order: 1 });
    } else if (status === "Pending" || status === "Completed") {
      todos = await Todo.find({
        status: status,
      }).sort({ order: 1 });
    } else if (status === "Paused") {
      todos = await Todo.find({
        isPaused: true,
      }).sort({ order: 1 });
    } else {
      return res.status(400).json({ error: "Invalid Request" });
    }
    res.json({ data: todos });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/todos", async (req, res) => {
  try {
    const { nftName, nftSymbol, prompt, width, height, price, nftCount } =
      req.body;
    if (
      nftName === "" ||
      nftSymbol === "" ||
      prompt === "" ||
      width <= 0 ||
      width % 8 > 0 ||
      height <= 0 ||
      height % 8 > 0
    ) {
      res.status(400).json({ error: "Invalid Request" });
    } else {
      // Find the current highest order value in the existing todos
      const highestOrderTodo = await Todo.findOne().sort("-order").exec();
      const newOrder = highestOrderTodo ? highestOrderTodo.order + 1 : 0;

      // Create a new Todo with the calculated order value
      const todo = new Todo({
        prompt,
        nftName,
        nftSymbol,
        width,
        height,
        price,
        nftCount,
        order: newOrder,
      });
      const newTodo = await todo.save();
      res.json(newTodo);
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Reorder todos endpoint
app.put("/api/todos/reorder", async (req, res) => {
  try {
    const { todos } = req.body;

    // Update each todo's order in the database based on the new order
    for (let i = 0; i < todos.length; i++) {
      await Todo.findByIdAndUpdate(todos[i]._id, { $set: { order: i } });
    }

    res.json({ message: "Order updated successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.put("/api/todos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { nftName, nftSymbol, prompt, width, height, price, nftCount } =
      req.body;
    if (
      nftName === "" ||
      nftSymbol === "" ||
      prompt === "" ||
      width <= 0 ||
      width % 8 > 0 ||
      height <= 0 ||
      height % 8 > 0
    ) {
      res.status(400).json({ error: "Invalid Request" });
    } else {
      const todo = await Todo.findByIdAndUpdate(
        id,
        { nftName, nftSymbol, prompt, width, height, price, nftCount },
        { new: true }
      );
      if (!todo) {
        return res.status(400).json({ error: "Todo not found" });
      }
      res.json({ message: "Todo updated successfully" });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.delete("/api/todos/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const todo = await Todo.findByIdAndDelete(id);
    if (!todo) {
      return res.status(400).json({ error: "Todo not found" });
    }
    res.json({ message: "Todo deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/tasks/pause/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const taskInfo = await Todo.findById(id);
    if (!taskInfo) {
      return res.status(400).json({ error: "Invalid Task" });
    }
    if (taskInfo.isPaused) {
      return res.status(400).json({ error: "Task is already paused" });
    }
    await Todo.findByIdAndUpdate(id, { isPaused: true });
    await saveLogging(new Date().toISOString() + ": Set to be Paused!");
    updateLogging({
      event_time: new Date().toISOString(),
      event_description: "Set to be Paused!",
    });
    res.json({ message: "Set to be Paused!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post("/api/tasks/continue/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const taskInfo = await Todo.findById(id);
    if (!taskInfo) {
      return res.status(400).json({ error: "Invalid Task" });
    }
    if (!taskInfo.isPaused) {
      return res.status(400).json({ error: "Task is already continuing" });
    }
    await Todo.findByIdAndUpdate(id, { isPaused: false });
    await saveLogging(new Date().toISOString() + ": Set to be Continued!");
    updateLogging({
      event_time: new Date().toISOString(),
      event_description: "Set to be Continued!",
    });
    res.json({ message: "Set to be Continued!" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get("/api/tasks/progress", async (req, res) => {
  try {
    const todos = await Todo.find(); //{ status: { $ne: "Pending" } }
    res.json({ data: todos, isRunning });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
//-================================================================================================================
app.get("/api/nft/tracking", async (req, res) => {
  let c;
  const todos = await Todo.find({
    status: "Completed",
  }).sort({ order: 1 });
  const result = await trackSalesOnTestNet(todos);
  // await Tracking.insertMany(result);
  try {
    for (const item of result) {
      await Tracking.updateOne(
        { nft_number: item.nft_number }, // Find document by unique field
        { $set: item }, // Update with new data
        { upsert: true } // Insert if not found
      );
    }
  } catch (err) {
    console.error("Error updating data:", err);
  }

  return res.json(result);
});

app.get("/api/nft/tracking/search", async (req, res) => {
  const keyword = req.query.keyword;

  try {
    // Check if the keyword is a valid date using moment.js
    const isDate = moment(keyword, moment.ISO_8601, true).isValid();

    // Define the base search query
    const searchQuery = [
      { nft_number: { $regex: keyword, $options: "i" } },
      { buyer_address: { $regex: keyword, $options: "i" } },
      { collection: { $regex: keyword, $options: "i" } },
      { collection_generation: { $regex: keyword, $options: "i" } },
      { nft_name: { $regex: keyword, $options: "i" } },
    ];

    // If the keyword is a valid date, include issue_date in the search
    if (isDate) {
      searchQuery.push({
        issue_date: { $gte: new Date(keyword), $lte: new Date(keyword) },
      });
    }

    // Perform the search in the database
    const results = await Tracking.find({ $or: searchQuery });

    return res.status(200).json(results);
  } catch (error) {
    console.error("Error fetching search results:", error);
    return res.status(500).json({ error: "Internal Server Error" });
  }
});

app.get("/api/nft/tracking/db", async (req, res) => {
  const result = await Tracking.find();
  return res.json(result);
});

app.get("/api/nft/logging", async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1; // Current page (default to 1)
    const limit = parseInt(req.query.limit) || 20; // Number of items per page (default to 20)
    const skip = (page - 1) * limit; // Calculate the number of items to skip

    const logs = await Logging.find()
      .sort({ event_time: -1 })
      .skip(skip)
      .limit(limit);
    res.status(200).json({ logs, page });
  } catch (error) {
    console.error("Error retrieving logs:", error);
    res.status(500).json({ error: "An error occurred while retrieving logs." });
  }
});

const updateLogging = async (data) => {
  const logging = new Logging(data);
  await logging.save();
};

const findLogsByDate = async (filter_date) => {
  try {
    const startOfDay = new Date(filter_date); // e.g., "2024-12-03T00:00:00.000Z"
    const endOfDay = new Date(filter_date);
    endOfDay.setDate(startOfDay.getDate() + 1);
    const endOfDayISOString = endOfDay.toISOString(); // e.g., "2024-12-04T00:00:00.000Z"
    // Query to find records within the specified range
    const logs = await Logging.find({
      event_time: {
        $gte: startOfDay,
        $lt: endOfDay,
      },
    });

    return logs;
  } catch (error) {
    console.error("Error finding logs by date:", error.message);
    throw error;
  }
};

const saveLogging = async (logs) => {
  fs.appendFileSync(filePath, logs + "\n");
};
//================================================================================================================
const updateTaskStatus = async (id, status, additionalFields = {}) => {
  await Todo.findByIdAndUpdate(id, { status, ...additionalFields });
};

const checkTaskIsPaused = async (id) => {
  try {
    const taskInfo = await Todo.findById(id);
    if (!taskInfo) return true;
    return taskInfo.isPaused;
  } catch (error) {
    return true;
  }
};

const nftMint = async (_task, toAddress) => {
  if (!isRunning) return true; // Stop processing if the loop is stopped

  const contractAddress = _task.contractAddress;
  const todoCount = _task.nftCount;
  let mintCount = _task.mintCount;

  if (_task.images.length !== todoCount) {
    console.log("Not same length between mint todo count and images count");
    await saveLogging(
      new Date().toISOString() +
        ": Not same length between mint todo count and images count"
    );
    await updateLogging({
      event_time: new Date().toISOString(),
      event: "Not same length between mint todo count and images count",
    });
    return false;
  }
  console.log(`start mint count:${mintCount} nftCount:${todoCount}`);
  await saveLogging(
    new Date().toISOString() +
      `: start mint count:${mintCount} nftCount:${todoCount}`
  );
  await updateLogging({
    event_time: new Date().toISOString(),
    event_description: `: start mint count:${mintCount} nftCount:${todoCount}`,
  });

  while (mintCount < todoCount) {
    if (!isRunning) return true; // Stop processing if the loop is stopped
    const paused = await checkTaskIsPaused(_task._id);
    if (paused) return true;
    const metadata = {
      description: "NFT Seller Bot",
      image: _task.images[mintCount],
      name: "NFTBOT",
      attributes: [
        {
          trait_type: "Generated NFTs",
          value: 10,
        },
      ],
    };
    const {
      data: { IpfsHash },
    } = await postPinataMetaData(metadata);
    const tokenURI = `https://ipfs.io/ipfs/${IpfsHash}`;
    console.log(`Got token uri : ${tokenURI}`);
    await saveLogging(
      new Date().toISOString() + `: Got token uri : ${tokenURI}`
    );
    await updateLogging({
      event_time: new Date().toISOString(),
      event_description: `: Got token uri : ${tokenURI}`,
    });

    const txHash = await mintNFT(contractAddress, toAddress, tokenURI);
    console.log("Mint hash:", txHash);
    await saveLogging(new Date().toISOString() + ": Mint hash: " + txHash);
    await updateLogging({
      event_time: new Date().toISOString(),
      event_description: ": Mint hash: " + txHash,
    });
    mintCount++;
    await Todo.findByIdAndUpdate(_task._id, { mintCount });
  }
  if (mintCount === todoCount) {
    await updateTaskStatus(_task._id, LIST_FOR_SALE);
    console.log("NFT Mint successful");
    await saveLogging(new Date().toISOString() + ": NFT Mint successful");
    await updateLogging({
      event_time: new Date().toISOString(),
      event_description: "NFT Mint successful",
    });
    return true;
  } else {
    await updateLogging({
      event_time: new Date().toISOString(),
      event_description: "Error NFT Mint",
    });
    console.log("Error NFT Mint:");
    await saveLogging(new Date().toISOString() + ": Error NFT Mint");
    return false;
  }
};

const listSale = async (_task) => {
  if (!isRunning) return true; // Stop processing if the loop is stopped

  const contractAddress = _task.contractAddress;
  const todoCount = _task.nftCount;
  let listCount = _task.listCount;

  if (_task.mintCount !== todoCount) {
    console.log("Not same length between listSale todo count and mint count");
    await saveLogging(
      new Date().toISOString() +
        ": Not same length between listSale todo count and mint count"
    );
    await updateLogging({
      event_time: new Date().toISOString(),
      event: "Not same length between listSale todo count and mint count",
    });
    return false;
  }
  console.log(`start list count:${listCount} nftCount:${todoCount}`);
  await saveLogging(
    new Date().toISOString() +
      `start list count:${listCount} nftCount:${todoCount}`
  );
  await updateLogging({
    event_time: new Date().toISOString(),
    event_description: `start list count:${listCount} nftCount:${todoCount}`,
  });
  while (listCount < todoCount) {
    if (!isRunning) return true; // Stop processing if the loop is stopped
    const paused = await checkTaskIsPaused(_task._id);
    if (paused) return true;
    await listForSale(
      contractAddress,
      listCount + 1, // tokenId value is from 1
      _task.price
    );
    console.log("List one sucessful tokenId:", listCount + 1);
    await saveLogging(
      new Date().toISOString() +
        ": List one sucessful tokenId:" +
        `${listCount + 1}`
    );
    await updateLogging({
      event_time: new Date().toISOString(),
      event_description: "List one sucessful tokenId: " + `${listCount + 1}`,
    });
    listCount++;
    await Todo.findByIdAndUpdate(_task._id, { listCount });
  }
  if (listCount === todoCount) {
    await updateTaskStatus(_task._id, COMPLETED);
    console.log("NFT list for sale successful");
    await saveLogging(
      new Date().toISOString() + ": NFT list for sale successful"
    );
    await updateLogging({
      event_time: new Date().toISOString(),
      event_description: "NFT list for sale successful",
    });
    return true;
  } else {
    console.log("Error NFT list for sale:");
    return false;
  }
};

const generateImages = async (_task) => {
  if (!isRunning) return true; // Stop processing if the loop is stopped

  let imgGeneratedCount = _task.imgGeneratedCount;
  let images = _task.images;
  const todoCount = _task.nftCount;

  console.log(
    `start generated count:${imgGeneratedCount} nftCount:${todoCount}`
  );
  saveLogging(
    new Date().toISOString() +
      `: start generated count:${imgGeneratedCount} nftCount:${todoCount}`
  );
  updateLogging({
    event_time: new Date().toISOString(),
    event_description: `: start generated count:${imgGeneratedCount} nftCount:${todoCount}`,
  });
  while (imgGeneratedCount < todoCount) {
    if (!isRunning) return true; // Stop processing if the loop is stopped
    const paused = await checkTaskIsPaused(_task._id);
    if (paused) return true;
    const genData = await generateImage(
      _task.prompt,
      _task.width,
      _task.height
    );
    const status = genData?.status;
    if (
      status !== null &&
      status !== undefined &&
      status !== "error" &&
      genData.output[0] !== undefined &&
      genData.output[0] !== null &&
      genData.output[0] !== ""
    ) {
      console.log("generated url:", genData.output[0]);
      await updateLogging({
        event_time: new Date().toISOString(),
        event_description: `generated url: ${genData.output[0]}`,
      });
      await saveLogging(
        new Date().toISOString() + `: generated url: + ${genData.output[0]}`
      );
      images.push(genData.output[0]);
      imgGeneratedCount++;
      await Todo.findByIdAndUpdate(_task._id, { imgGeneratedCount, images });
      await updateLogging({
        event_time: new Date().toISOString(),
        event_description: `generated url: ${genData.output[0]}`,
      });
      return true;
    } else {
      console.log(`generate error status:${status} message:${genData}`);
      return false;
    }
  }
  await updateTaskStatus(_task._id, NFT_DEPLOY);
  console.log("Image generation successful");
  await saveLogging(new Date().toISOString() + ": Image generation successful");
  await updateLogging({
    event_time: new Date().toISOString(),
    event_description: "Image generation successful",
  });
  return true;
};

const processSellerBot = async (_task) => {
  if (!isRunning || !_task || _task.status === COMPLETED || _task.isPaused)
    return;

  try {
    if (_task.isFailure) {
      await Todo.findByIdAndUpdate(_task._id, { isFailure: false });
    }

    const isPausedStatus = async () => {
      const taskInfo = await Todo.findById(_task._id);
      return taskInfo.isPaused;
    };

    const steps = [
      {
        status: PENDING,
        nextStatus: NFT_DEPLOY,
        action: async () => {
          await updateTaskStatus(_task._id, IMAGE_GENERATION);
        },
      },
      {
        status: IMAGE_GENERATION,
        nextStatus: NFT_DEPLOY,
        action: async () => {
          const ret = await generateImages(_task);
          return ret;
        },
      },
      {
        status: NFT_DEPLOY,
        nextStatus: NFT_MINT,
        action: async () => {
          if (!isRunning) return;
          const contractAddress = await deployContract(
            _task.nftName,
            _task.nftSymbol
          );
          await updateTaskStatus(_task._id, NFT_MINT, { contractAddress });
        },
      },
      {
        status: NFT_MINT,
        nextStatus: LIST_FOR_SALE,
        action: async () => {
          if (_task.contractAddress) {
            const ret = await nftMint(_task, process.env.ADMIN_WALLET_ADDRESS);
            return ret;
          } else {
            return false;
          }
        },
      },
      {
        status: LIST_FOR_SALE,
        nextStatus: COMPLETED,
        action: async () => {
          if (_task.contractAddress) {
            const ret = await listSale(_task);
            return ret;
          } else {
            return false;
          }
        },
      },
    ];

    for (const step of steps) {
      if (_task.status === step.status) {
        const success = await step.action();
        if (success === false) {
          await Todo.findByIdAndUpdate(_task._id, { isFailure: true });
          return;
        }
        if (await isPausedStatus()) break;
      }
    }
  } catch (error) {
    await Todo.findByIdAndUpdate(_task._id, { isFailure: true });
    await updateLogging({
      event_time: new Date().toISOString(),
      event_description: "Processing error:" + error.response?.data,
    });
    await saveLogging(
      new Date().toISOString() + ": Processing error:" + error.response?.data
    );
    console.log("Processing error:", error.response?.data);
  }
};

// Recursive task processor using `setTimeout` to avoid overlapping
const processTasks = async () => {
  if (!isRunning) return; // Stop processing if the loop is stopped
  console.log("Scanning tasks...");
  await saveLogging(new Date().toISOString() + ": Starting processing...");
  await updateLogging({
    event_time: new Date().toISOString(),
    event_description: "Starting processing...",
  });
  await saveLogging(new Date().toISOString() + ": Scanning tasks...");
  await updateLogging({
    event_time: new Date().toISOString(),
    event_description: "Scanning tasks...",
  });
  const tasks = await Todo.find({
    status: { $ne: COMPLETED },
    isPaused: false,
  }).sort({
    order: 1,
  });
  console.log(`Found ${tasks.length} tasks`);
  await saveLogging(new Date().toISOString() + `: Found ${tasks.length} tasks`);
  await updateLogging({
    event_time: new Date().toISOString(),
    event_description: `Found ${tasks.length} tasks`,
  });
  if (tasks.length === 0) isRunning = false;

  for (const task of tasks) {
    if (!isRunning) return; // Stop processing if the loop is stopped
    await processSellerBot(task);
  }

  // Schedule the next cycle after a delay (e.g., 5 seconds)
  setTimeout(processTasks, 5000);
};

// Route to start the task processing loop
app.post("/api/tasks/start", (req, res) => {
  console.log("Starting processing...");
  if (isRunning) {
    return res.status(400).json({ message: "Processing is already running." });
  }

  isRunning = true;
  processTasks(); // Start the recursive task processing

  return res.status(200).json({ message: "Processing started." });
});

// Route to stop the task processing loop
app.post("/api/tasks/stop", (req, res) => {
  if (!isRunning) {
    return res.status(400).json({ message: "No processing is running." });
  }

  isRunning = false; // Stop the processing loop
  saveLogging(new Date().toISOString() + ": Processing stopped.");
  updateLogging({
    event_time: new Date().toISOString(),
    event_description: "Processing stopped",
  });
  return res.status(200).json({ message: "Processing stopped." });
});

// Route to check the status of the task processing loop
app.get("/api/tasks/status", (req, res) => {
  const status = isRunning ? true : false;
  return res.status(200).json({ status });
});

// ------------ NFT type Management --------------

// Create a new NFT Type
app.post("/api/nft-types", async (req, res) => {
  try {
    const nftType = new NftType(req.body);
    await nftType.save();
    res.status(201).send(nftType);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// Get all NFT Types
app.get("/api/nft-types", async (req, res) => {
  try {
    const nftTypes = await NftType.find();
    res.status(200).send(nftTypes);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Get a specific NFT Type by ID
app.get("/api/nft-types/:id", async (req, res) => {
  try {
    const nftType = await NftType.findById(req.params.id);
    if (!nftType) return res.status(404).send("NFT Type not found");
    res.status(200).send(nftType);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// Update an NFT Type by ID
app.put("/api/nft-types/:id", async (req, res) => {
  try {
    const nftType = await NftType.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!nftType) return res.status(404).send("NFT Type not found");
    res.status(200).send(nftType);
  } catch (error) {
    res.status(400).send(error.message);
  }
});

// Delete an NFT Type by ID
app.delete("/api/nft-types/:id", async (req, res) => {
  try {
    const nftType = await NftType.findByIdAndDelete(req.params.id);
    if (!nftType) return res.status(404).send("NFT Type not found");
    res.status(200).json({ message: "Deleted Successfully" });
  } catch (error) {
    res.status(500).send(error.message);
  }
});

const PORT = process.env.PORT || 5002;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
