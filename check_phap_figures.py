import zipfile, re, xml.etree.ElementTree as ET
from collections import Counter
p=r'C:\Users\bolab\OneDrive\เดสก์ท็อป\วิจัยจบ\การพัฒนาแอปพลิเคชันแชทบอทให้คำแนะนำสำหรับผู้เป็นเบาหวาน_จัดเลขหน้าและสารบัญ.docx'
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
z=zipfile.ZipFile(p)
root=ET.fromstring(z.read('word/document.xml'))
paras=[]
for para in root.findall('.//w:p', ns):
    s=''.join((t.text or '') for t in para.findall('.//w:t', ns)).strip()
    if s:
        paras.append(s)
# captions with ภาพที่ only, excluding TOF dot leader lines
caps=[]
for i,s in enumerate(paras):
    m=re.match(r'^ภาพที่\s*(\d+)\s*(.*)$', s)
    if m and '...' not in s and '…' not in s:
        caps.append((i,int(m.group(1)),m.group(2).strip(),s))
nums=[n for _,n,_,_ in caps]
print('PHAP_CAPTION_COUNT', len(caps))
print('MINMAX', min(nums) if nums else None, max(nums) if nums else None)
print('DUPLICATES', sorted([n for n,c in Counter(nums).items() if c>1]))
print('MISSING_1_88', [n for n in range(1,89) if n not in nums])
print('OUT_OF_RANGE', [n for n in nums if n<1 or n>88])
print('---PHAP_CAPTIONS---')
for i,n,title,s in caps:
    print(f'{n}\t{title}')
# Existing TOF lines with pages
print('---TOF_MAP---')
tof=[]
for i,s in enumerate(paras):
    m=re.match(r'^(?:ภาพ|รูป)ที่\s*(\d+)\s+(.*?)\s*[.…]+\s*(\d+)\s*$', s)
    if m:
        tof.append((int(m.group(1)),m.group(2).strip(),m.group(3),s))
for n,title,page,s in tof:
    print(f'{n}\t{title}\t{page}')
