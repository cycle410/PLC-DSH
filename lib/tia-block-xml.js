function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildSclObXml({ name, number = 123, code = '' } = {}) {
  if (!name) throw new Error('An OB name is required.')
  const body = escapeXml(code).trim()
  return `<?xml version="1.0" encoding="utf-8"?>
<Document>
  <Engineering version="V16" />
  <SW.Blocks.OB ID="0">
    <AttributeList>
      <Interface><Sections xmlns="http://www.siemens.com/automation/Openness/SW/Interface/v4">
  <Section Name="Temp" />
  <Section Name="Constant" />
</Sections></Interface>
      <MemoryLayout>Optimized</MemoryLayout>
      <Name>${escapeXml(name)}</Name>
      <Number>${Number(number)}</Number>
      <ProgrammingLanguage>SCL</ProgrammingLanguage>
      <SecondaryType>ProgramCycle</SecondaryType>
      <SetENOAutomatically>false</SetENOAutomatically>
    </AttributeList>
    <ObjectList>
      <SW.Blocks.CompileUnit ID="3" CompositionName="CompileUnits">
        <AttributeList>
          <NetworkSource>
            <StructuredText xmlns="http://www.siemens.com/automation/Openness/SW/NetworkSource/StructuredText/v3">
              <Text UId="1">
${body}
              </Text>
            </StructuredText>
          </NetworkSource>
          <ProgrammingLanguage>SCL</ProgrammingLanguage>
        </AttributeList>
        <ObjectList>
          <MultilingualText ID="4" CompositionName="Comment">
            <ObjectList>
              <MultilingualTextItem ID="5" CompositionName="Items">
                <AttributeList><Culture>zh-CN</Culture><Text /></AttributeList>
              </MultilingualTextItem>
            </ObjectList>
          </MultilingualText>
          <MultilingualText ID="6" CompositionName="Title">
            <ObjectList>
              <MultilingualTextItem ID="7" CompositionName="Items">
                <AttributeList><Culture>zh-CN</Culture><Text>${escapeXml(name)}</Text></AttributeList>
              </MultilingualTextItem>
            </ObjectList>
          </MultilingualText>
        </ObjectList>
      </SW.Blocks.CompileUnit>
      <MultilingualText ID="8" CompositionName="Title">
        <ObjectList>
          <MultilingualTextItem ID="9" CompositionName="Items">
            <AttributeList><Culture>zh-CN</Culture><Text>"${escapeXml(name)}"</Text></AttributeList>
          </MultilingualTextItem>
        </ObjectList>
      </MultilingualText>
    </ObjectList>
  </SW.Blocks.OB>
</Document>
`
}

export function buildGlobalDbXml({ name, number = 124, members = [] } = {}) {
  if (!name) throw new Error('A DB name is required.')
  const rows = members
    .filter((member) => member && member.name)
    .map((member) => `    <Member Name="${escapeXml(member.name)}" Datatype="${escapeXml(member.dataType ?? 'Bool')}" />`)
    .join('\n')
  return `<?xml version="1.0" encoding="utf-8"?>
<Document>
  <Engineering version="V16" />
  <SW.Blocks.GlobalDB ID="0">
    <AttributeList>
      <Interface><Sections xmlns="http://www.siemens.com/automation/Openness/SW/Interface/v4">
  <Section Name="Static">
${rows}
  </Section>
</Sections></Interface>
      <MemoryLayout>Optimized</MemoryLayout>
      <Name>${escapeXml(name)}</Name>
      <Number>${Number(number)}</Number>
      <ProgrammingLanguage>DB</ProgrammingLanguage>
    </AttributeList>
  </SW.Blocks.GlobalDB>
</Document>
`
}
