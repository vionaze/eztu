declare module "xlsx-populate" {
  type Workbook = {
    outputAsync(options: { type: "nodebuffer"; password?: string }): Promise<Buffer>;
  };
  const XlsxPopulate: {
    fromDataAsync(data: Buffer, options?: { password?: string }): Promise<Workbook>;
  };
  export default XlsxPopulate;
}
