const { Op } = require("sequelize");

const getPagination = (page, size) => {
  const limit = size ? +size : +process.env.DEFAULT_PAGE_SIZE;
  const offset = page ? (page - 1) * limit : 0;

  return { limit, offset };
};

const getPagingData = (data, page, limit) => {
  const { count: totalItems, rows: items } = data;
  const currentPage = page ? +page : 1;
  const totalPages = Math.ceil(totalItems / limit);

  return {
    totalItems,
    items,
    totalPages,
    currentPage,
    pageSize: limit,
  };
};

const getSearchCondition = (searchFields, searchTerm) => {
  if (!searchTerm) return {};

  return {
    [Op.or]: searchFields.map((field) => ({
      [field]: {
        [Op.like]: `%${searchTerm}%`,
      },
    })),
  };
};

module.exports = {
  getPagination,
  getPagingData,
  getSearchCondition,
};
