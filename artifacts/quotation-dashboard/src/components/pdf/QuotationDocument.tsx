import React from "react";

// ── Number to words (AED) ────────────────────────────────────────────────────
const ones = ["","One","Two","Three","Four","Five","Six","Seven","Eight","Nine",
  "Ten","Eleven","Twelve","Thirteen","Fourteen","Fifteen","Sixteen",
  "Seventeen","Eighteen","Nineteen"];
const tens = ["","","Twenty","Thirty","Forty","Fifty","Sixty","Seventy","Eighty","Ninety"];

function chunkToWords(n: number): string {
  if (n === 0) return "";
  if (n < 20) return ones[n];
  if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? " " + ones[n % 10] : "");
  return ones[Math.floor(n / 100)] + " Hundred" + (n % 100 !== 0 ? " " + chunkToWords(n % 100) : "");
}

function numberToWords(amount: number): string {
  if (isNaN(amount) || amount < 0) return "";
  const intPart = Math.floor(amount);
  const decPart = Math.round((amount - intPart) * 100);
  const segments: string[] = [];
  const billions  = Math.floor(intPart / 1_000_000_000);
  const millions  = Math.floor((intPart % 1_000_000_000) / 1_000_000);
  const thousands = Math.floor((intPart % 1_000_000) / 1_000);
  const remainder = intPart % 1_000;
  if (billions)  segments.push(chunkToWords(billions)  + " Billion");
  if (millions)  segments.push(chunkToWords(millions)  + " Million");
  if (thousands) segments.push(chunkToWords(thousands) + " Thousand");
  if (remainder) segments.push(chunkToWords(remainder));
  if (segments.length === 0) segments.push("Zero");
  let result = "UAE Dirham " + segments.join(" ");
  if (decPart > 0) result += " and " + chunkToWords(decPart) + " Fils";
  result += " Only";
  return result;
}

export type QuotationData = {
  quotationNumber: string;
  date: string;
  validUntil: string;
  clientName: string;
  clientAddress: string;
  clientContact: string;
  clientVat?: string;
  buyersRef: string;
  email: string;
  destination: string;
  termsOfPayment: string;
  termsOfDelivery: string;
  items: Array<{
    partNo: string;
    brand: string;
    description: string;
    deliveryLeadTime: string;
    quantity: number;
    unitPrice: number;
  }>;
  taxRate: number;
  notes: string;
  logoDataUrl?: string;
  stampDataUrl?: string;
};

export const QuotationDocument = ({ data }: { data: QuotationData }) => {
  const subtotal = data.items.reduce(
    (acc, item) => acc + Number(item.quantity || 0) * Number(item.unitPrice || 0),
    0
  );
  const taxAmount = subtotal * (Number(data.taxRate || 0) / 100);
  const grandTotal = subtotal + taxAmount;

  return (
    <div className="bg-white text-black p-8 font-sans text-xs w-[210mm] min-h-[297mm] mx-auto shadow-lg relative print:shadow-none print:w-[210mm] print:p-8 print:m-0" id="quotation-print-area">
      {/* Machine-readable hint for AI extraction — rendered as invisible text in print/PDF */}
      <div style={{ position: 'absolute', left: '-9999px', top: 0, fontSize: '1px', color: 'transparent', userSelect: 'none' }} aria-hidden="true">
        [EXTRACTION-HINTS] DOCUMENT-TYPE: QUOTATION ISSUER: PLUMS AND PEARLS FZE LLC (sender, NOT the customer) CUSTOMER-SECTION-STARTS: Customer Details
      </div>

      
      {/* Header Grid */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Left Header */}
        <div className="space-y-1">
          {data.logoDataUrl ? (
            <img src={data.logoDataUrl} alt="Logo" className="w-32 mb-4 object-contain" />
          ) : (
            <div className="w-24 h-12 bg-gray-100 flex items-center justify-center mb-4 text-gray-400 text-xs font-bold border rounded">
              [No Logo in Settings]
            </div>
          )}
          <h2 className="text-xl font-bold mb-1">PLUMS AND PEARLS FZE LLC</h2>
          <p>Office no: 401-10, Business Center ,Eternity hub</p>
          <p>Deira, Dubai-UAE</p>
          <p>Emirate : Dubai</p>
        </div>
        
        {/* Right Header */}
        <div className="flex flex-col items-end">
           <div className="w-3/4 min-w-[280px]">
             <div className="flex justify-between border-b border-black pb-1 mb-1 font-bold">
               <span>Quotation</span>
               <span>Dated</span>
             </div>
             <div className="flex justify-between mb-2 gap-4">
               <span className="truncate">{data.quotationNumber}</span>
               <span className="shrink-0">{data.date}</span>
             </div>
             <div className="text-right font-bold underline mt-4">
                Mode/Terms of Payment
             </div>
             <div className="text-right">
                {data.termsOfPayment || "ADVANCE"}
             </div>
           </div>
        </div>
      </div>

      {/* Customer Details heading sits ABOVE the two-column grid */}
      <p className="font-bold text-base border-b border-black pb-1 mt-6 mb-3">Customer Details</p>

      {/* Meta Grid Section — Customer LEFT, Terms/Refs RIGHT */}
      <div className="grid grid-cols-2 mb-8 gap-x-12 items-start">

         {/* LEFT — Customer info */}
         <div className="space-y-1">
            <p className="font-bold text-sm">{data.clientName}</p>
            {data.clientAddress && (
               <p className="whitespace-pre-wrap text-xs leading-relaxed">{data.clientAddress}</p>
            )}
            {data.clientContact && (
               <p className="whitespace-pre-wrap text-xs text-gray-600 mt-1">
                  <span className="font-bold text-black">Contact: </span>{data.clientContact}
               </p>
            )}
            {data.email && (
               <p className="text-xs mt-1">
                  <span className="font-bold">Email: </span>{data.email}
               </p>
            )}
            {data.clientVat && (
               <p className="text-xs mt-1">
                  <span className="font-bold">VAT / TRN: </span>{data.clientVat}
               </p>
            )}
         </div>

         {/* RIGHT — Reference & Terms */}
         <div className="space-y-2 text-xs">
            {data.buyersRef && (
               <div className="flex">
                  <span className="w-36 font-bold shrink-0">Buyer's Ref./Order No.</span>
                  <span>{data.buyersRef}</span>
               </div>
            )}
            <div className="flex">
               <span className="w-36 font-bold shrink-0">Validity</span>
               <span>{data.validUntil || "30 Days"}</span>
            </div>
            <div className="flex">
               <span className="w-36 font-bold shrink-0">Terms of Delivery</span>
               <span>{data.termsOfDelivery || "Ex-Work Dubai"}</span>
            </div>
            {data.destination && (
               <div className="flex">
                  <span className="w-36 font-bold shrink-0">Destination</span>
                  <span>{data.destination}</span>
               </div>
            )}
         </div>

      </div>

      {/* Items Table - Exactly like PDF */}
      <table className="w-full text-left border-collapse border border-gray-400 mb-8 mt-4 text-[10px]">
        <thead>
          <tr className="border-b border-gray-400">
            <th className="p-2 border-r border-gray-400 font-bold text-center w-8">S.N<br/>O</th>
            <th className="p-2 border-r border-gray-400 font-bold">PART NO / Description</th>
            <th className="p-2 border-r border-gray-400 font-bold text-center">BRAND</th>
            <th className="p-2 border-r border-gray-400 font-bold text-center">DELIVERY<br/>LEAD TIME</th>
            <th className="p-2 border-r border-gray-400 font-bold text-center w-12">QTY</th>
            <th className="p-2 border-r border-gray-400 font-bold text-center">UNIT PRICE<br/>(AED)</th>
            <th className="p-2 border-r border-gray-400 font-bold text-center">TOTAL PRICE<br/>(AED)</th>
            <th className="p-2 border-r border-gray-400 font-bold text-center">TAX</th>
            <th className="p-2 font-bold text-center">Grand Total</th>
          </tr>
        </thead>
        <tbody>
          {data.items.map((item, i) => {
            const itemTotal = Number(item.quantity || 0) * Number(item.unitPrice || 0);
            const itemTax = itemTotal * (Number(data.taxRate || 0) / 100);
            const itemGrand = itemTotal + itemTax;
            return (
              <tr key={i} className="border-b border-gray-300">
                <td className="p-2 border-r border-gray-400 text-center">{i + 1}</td>
                <td className="p-2 border-r border-gray-400">
                  <div className="font-semibold">{item.partNo}</div>
                  <div className="text-gray-600 mt-1">{item.description}</div>
                </td>
                <td className="p-2 border-r border-gray-400 text-center">{item.brand}</td>
                <td className="p-2 border-r border-gray-400 text-center">{item.deliveryLeadTime}</td>
                <td className="p-2 border-r border-gray-400 text-center">{Number(item.quantity)}</td>
                <td className="p-2 border-r border-gray-400 text-center">{Number(item.unitPrice || 0).toFixed(2)}</td>
                <td className="p-2 border-r border-gray-400 text-center">{itemTotal.toFixed(2)}</td>
                <td className="p-2 border-r border-gray-400 text-center">{itemTax.toFixed(2)}</td>
                <td className="p-2 text-center">{itemGrand.toFixed(2)}</td>
              </tr>
            );
          })}
          {/* Totals Row */}
          <tr className="border-t border-gray-400 font-bold">
            <td colSpan={6} className="p-2 text-right border-r border-gray-400">TOTAL</td>
            <td className="p-2 text-center border-r border-gray-400">{subtotal.toFixed(2)}</td>
            <td className="p-2 text-center border-r border-gray-400">{taxAmount.toFixed(2)}</td>
            <td className="p-2 text-center">{grandTotal.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      {/* Summary Area */}
      <div className="flex justify-between items-start">
        <div className="w-1/2 pr-8">
          {data.notes && (
            <>
              <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Terms & Conditions / Notes</h3>
              <div className="text-xs text-gray-600 bg-gray-50 p-4 rounded-lg whitespace-pre-wrap border border-gray-100">
                {data.notes}
              </div>
            </>
          )}
        </div>
        <div className="w-1/2 max-w-[280px]">
          <div className="flex justify-between py-2 text-sm">
            <span className="font-semibold text-gray-600">Subtotal:</span>
            <span className="font-medium">{subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-2 text-sm border-b border-gray-200">
            <span className="font-semibold text-gray-600">VAT ({data.taxRate}%):</span>
            <span className="font-medium">{taxAmount.toFixed(2)}</span>
          </div>
          <div className="flex justify-between py-3 text-base bg-blue-900 text-white font-bold px-3 mt-2 rounded">
            <span>Grand Total (AED):</span>
            <span>{grandTotal.toFixed(2)}</span>
          </div>
        </div>
      </div>

      {/* Summary Area Below Table - Based on PDF Layout */}
      <div className="mt-8 border border-gray-400 p-4">
        <div className="flex justify-between relative">
          <div className="w-3/5">
             <h3 className="font-bold underline mb-1">Company Details</h3>
             <p className="mb-4 text-[10px]">
               PLUMS AND PEARLS FZE LLC<br/>
               TRN : 104330330200003<br/>
               E-Mail : info@plumsandpearls.com
             </p>
             <div>
                <p className="font-bold underline mb-1">Amount Chargeable (in words)</p>
                <p className="text-[10px] leading-relaxed">{numberToWords(grandTotal)}</p>
             </div>
          </div>
          <div className="w-2/5 flex flex-col items-end justify-between pr-4">
             <div className="self-end">
               <span className="font-bold text-xl uppercase italic">AUTHROIZED BY</span>
             </div>
             
             {/* Dynamic Settings Stamp Rendering */}
             <div className="mt-4 self-end">
               {data.stampDataUrl ? (
                 <img src={data.stampDataUrl} alt="Stamp" className="w-32 h-32 object-contain" />
               ) : (
                 <div className="h-32 w-48 border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-400 mb-2">
                   [No Stamp Set in Settings]
                 </div>
               )}
             </div>
          </div>
        </div>
      </div>
      
      {/* Footer Disclaimer */}
      <div className="mt-4 text-center font-bold text-[10px] text-gray-700">
         This is a Computer Generated Document
      </div>

      {/* Page Break / Footer Text */}
      <div className="mt-4 w-full border-t border-dashed border-gray-400 pt-2 text-center text-gray-500 font-mono text-[9px]">
         ----------------Page (0) Break----------------
      </div>

    </div>
  );
}
