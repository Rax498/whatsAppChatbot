export const formatCatalog = (catalog) => {
  if (!catalog || !catalog.categories || !catalog.items) {
    return "Catalog data is unavailable.";
  }

  // Map categoryId to categoryName for easy lookup
  const categoryMap = {};
  for (const cat of catalog.categories) {
    categoryMap[cat.categoryId] = cat.name;
  }

  // Group items by categoryId
  const itemsByCategory = {};
  for (const item of catalog.items) {
    if (item.status !== "Active") continue;
    const catName = categoryMap[item.categoryId] || "Other";
    if (!itemsByCategory[catName]) itemsByCategory[catName] = [];
    itemsByCategory[catName].push(item);
  }

  let resultLines = [];
  // Format each category and its items
  for (const [catName, items] of Object.entries(itemsByCategory)) {
    resultLines.push(`*${catName}*:`);

    for (const item of items) {
      const price = item.price ? `₹${item.price}` : "";
      const desc = item.description ? ` - ${item.description}` : "";
      resultLines.push(`- ${item.itemName}${desc} | ${price}`);
    }
    resultLines.push(""); // empty line between categories
  }

  const output = resultLines.join("\n");

  // Limit message length for chat apps (e.g., WhatsApp limit ~4096 chars)
  if (output.length > 4000) {
    return output.substring(0, 3990) + "\n...and more items.";
  }

  return output || "No items available.";
};

// ---Formating Resources----

export const formatResources = (resources) => {
  if (!Array.isArray(resources) || resources.length === 0) {
    return "No resources available.";
  }

  const lines = ["Available Resources:"];
  for (const res of resources) {
    if (res.status === "Active") {
      lines.push(
        ` ${res.name} |resourceId: ${res.resourceId} | Capacity: ${res.capacity}`
      );
    }
  }
  return lines.join("\n");
};

// ---Formating soldoutItems----
export const formatSoldout = (TableData) => {
  const TableMap = [];
  for (const tables of TableData.data) {
    TableMap.push(`Name: ${tables.shortName} | code: ${tables.skuCode}`);
  }
  return TableData.join("\n");
};

// __FormateTodaysale__
export const formatSalesToday = (salesData) => {
  const totalsByBranch = {};

  for (const sale of salesData.data) {
    const branch = sale.branchName;
    const totalAmount = sale.totalAmount || 0;

    if (!totalsByBranch[branch]) {
      totalsByBranch[branch] = 0;
    }
    totalsByBranch[branch] += totalAmount;
  }

  let message = "📊 Today's sale summary:\n\n";
  for (const [branch, total] of Object.entries(totalsByBranch)) {
    message += `🏢 ${branch}: ₹${total.toFixed(2)}\n`;
  }

  return message;
};
