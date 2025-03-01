const axios = require("axios").default;
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const fs = require("fs");
const path = require("path");
const FormData = require("form-data");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(bodyParser.json());
app.use(cors());

const JWT = process.env.PINATA_JWT;

// Function to pin a file (here, our metadata JSON) to IPFS using Pinata
async function pinFileToIPFS(filePath, fileName) {
  try {
    const formData = new FormData();
    const file = fs.createReadStream(filePath);
    formData.append("file", file);
    const pinataMetadata = JSON.stringify({ name: fileName });
    formData.append("pinataMetadata", pinataMetadata);
    const pinataOptions = JSON.stringify({ cidVersion: 0 });
    formData.append("pinataOptions", pinataOptions);
    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        headers: {
          ...formData.getHeaders(),
          Authorization: `Bearer ${JWT}`,
        },
      }
    );
    return response.data;
  } catch (error) {
    console.error("Error in pinFileToIPFS:", error);
    throw error;
  }
}

// NFT Creation Endpoint: Expects id, name, description, image_uri and optionally attributes from the frontend.
app.post("/create-nft", async (req, res) => {
  const { id, name, description, image_uri, attributes } = req.body;

  // Validate required fields
  if (!id || !name || !description || !image_uri) {
    console.log("NFT Creation Request failed: Missing required fields");
    return res.status(400).send({
      success: false,
      message: "Missing required fields: id, name, description, or image_uri.",
    });
  }

  console.log(`Creating NFT metadata for: ${name} (ID: ${id})`);

  // Construct NFT metadata using the provided image URI
  const nftMetadata = {
    id: id,
    name: name,
    description: description,
    image: image_uri,
    attributes: attributes || [],
  };

  // Write metadata JSON file locally
  const metadataFileName = `nft-${id}.json`;
  const metadataPath = path.join(__dirname, metadataFileName);
  fs.writeFileSync(metadataPath, JSON.stringify(nftMetadata, null, 2), {
    flag: "w",
  });

  try {
    // Pin the metadata JSON file to IPFS
    console.log(`Pinning metadata file for NFT ID: ${id}`);
    const pinataResponse = await pinFileToIPFS(
      metadataPath,
      `NFT_Metadata_${id}`
    );
    const metadataIPFSUrl = `https://ipfs.io/ipfs/${pinataResponse.IpfsHash}`;
    console.log(`Metadata pinned successfully: ${metadataIPFSUrl}`);

    // Send back the pinned metadata URL
    res.status(200).send({
      success: true,
      message: "NFT metadata successfully pinned to IPFS.",
      metadataIPFSUrl: metadataIPFSUrl,
    });
  } catch (err) {
    console.error("Error in NFT creation endpoint:", err);
    res.status(500).send({
      success: false,
      error: err.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
