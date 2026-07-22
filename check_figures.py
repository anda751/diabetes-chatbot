import zipfile, re, xml.etree.ElementTree as ET
from collections import Counter
p=r'C:\Users\bolab\OneDrive\เดสก์ท็อป\วิจัยจบ\การพัฒนาแอปพลิเคชันแชทบอทให้คำแนะนำสำหรับผู้เป็นเบาหวาน_จัดเลขหน้าและสารบัญ.docx'
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
z=zipfile.ZipFile(p)
root=ET.fromstring(z.read('word/document.xml'))
paras=[]
for para in root.findall('.//w:p',ns):
    s=''.join((t.text or '') for t in para.findall('.//w:t',ns)).strip()
    if s:
        paras.append(s)
fig_caps=[]
for i,s in enumerate(paras):
    m=re.match(r'^(ภาพ|รูป)ที่\s*(\d+)\s*(.*)$', s)
    if m:
        if '...' in s or '…' in s:
            continue
        fig_caps.append((i,m.group(1),int(m.group(2)),m.group(3).strip(),s))
nums=[n for _,_,n,_,_ in fig_caps]
print('CAPTION_COUNT',len(fig_caps))
print('MINMAX', min(nums) if nums else None, max(nums) if nums else None)
print('DUPLICATES', sorted([n for n,c in Counter(nums).items() if c>1]))
missing=[n for n in range(1,(max(nums) if nums else 0)+1) if n not in nums]
print('MISSING',missing)
print('---CAPTIONS---')
for item in fig_caps:
    print(f'{item[0]}|{item[1]}ที่ {item[2]}|{item[3]}')
print('---TOF_LINES---')
tof=[]
for i,s in enumerate(paras):
    if re.match(r'^รูปที่\s*\d+', s) and ('...' in s or '…' in s):
        tof.append((i,s))
print('TOF_COUNT',len(tof))
for i,s in tof:
    print(f'{i}|{s}')
