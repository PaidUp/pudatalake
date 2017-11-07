const chai = require("chai");
const expect = chai.expect;
const service = require("../../server/services/db.service");

describe("Mongo service test", () => {
  it("Establish connection", (done) => {
    service.connect((err, data) => {
      expect(err).to.be.null;
      done();

    });

  });
});