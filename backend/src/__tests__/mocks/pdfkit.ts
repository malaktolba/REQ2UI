import { EventEmitter } from "events";

class PDFDocument extends EventEmitter {
  y = 100;
  fontSize() { return this; }
  font() { return this; }
  fillColor() { return this; }
  text() { return this; }
  moveDown() { return this; }
  moveTo() { return { lineTo: () => ({ strokeColor: () => ({ stroke: () => this }) }) }; }
  image() { return this; }
  addPage() { return this; }
  end() { this.emit("end"); }
}

module.exports = PDFDocument;
